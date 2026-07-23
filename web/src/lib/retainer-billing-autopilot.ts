import "server-only";

import { formatClientCaseLabel, formatPeso } from "@/lib/gl-config";
import { matterTypeCaseLabel, resolveClientMatterType } from "@/lib/client-matter-type";
import { triggerTaskOnCharge } from "@/lib/billing-task-triggers";
import { issueSoaHeadlessForClient } from "@/lib/issue-soa-headless";
import { enqueueBillingOpsAlert } from "@/lib/billing-ops-alerts";
import { resolveRetainerDetailsFromClient, summarizePackageCoverage } from "@/lib/retainer-package";
import {
  buildRetainerBillingTasks,
  normalizeRetainerBillingCycle,
  nextRetainerBillingDateYmd,
  type RetainerIntakeDetails
} from "@/lib/intake-path-workflows";
import { appendTask } from "@/lib/office-tasks/sheets/tasks";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { addLedgerEntry } from "@/lib/sheets/ledger";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { getClients } from "@/lib/sheets/master";
import type { ClientSummary } from "@/lib/gl-config";
import { getLastSentSoa } from "@/lib/soa-follow-up";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import {
  ledgerHasRetainerMonthlyCharge,
  retainerBillingAutopilotMarker,
  retainerBillingPeriodKey,
  retainerMonthlyChargeDescription
} from "@/lib/retainer-billing-autopilot-utils";

function taskExists(
  items: Array<{ clientCase: string; details: string; remarks: string; date: string | null }>,
  clientCase: string,
  description: string,
  dueDate: string
): boolean {
  const key = description.trim().toLowerCase();
  return items.some(
    (item) =>
      item.clientCase.trim().toLowerCase() === clientCase.trim().toLowerCase() &&
      item.details.trim().toLowerCase() === key &&
      String(item.date || "").slice(0, 10) === dueDate
  );
}

function resolveRetainerDetails(client: ClientSummary): RetainerIntakeDetails | null {
  return resolveRetainerDetailsFromClient(client);
}

function soaAlreadySentOnDate(lastSoaDate: string, billingDate: string): boolean {
  const last = String(lastSoaDate || "").trim();
  const due = String(billingDate || "").trim().slice(0, 10);
  if (!last || !due) return false;
  if (last.slice(0, 10) === due) return true;
  // Document log may use locale strings — match YYYY-MM-DD substring if present.
  return last.includes(due);
}

export type RetainerBillingAutopilotResult = {
  created: number;
  skipped: number;
  chargesPosted: number;
  soasSent: number;
  errors: string[];
  clients: string[];
  dryRun?: boolean;
  planned?: string[];
};

/** On retainer billing due dates: post monthly fee, email SOA, and seed fallback tasks if needed. */
export async function seedDueRetainerBillingTasks(
  accessToken: string,
  options?: { today?: string; auditUser?: string; dryRun?: boolean }
): Promise<RetainerBillingAutopilotResult> {
  const today = options?.today || todayYmd();
  const auditUser = options?.auditUser || "cron:retainer-billing";
  const dryRun = Boolean(options?.dryRun);
  const periodKey = retainerBillingPeriodKey(today);
  const clients = await getClients(accessToken);
  const existing = dryRun ? [] : await collectAllItems(accessToken);
  const taskItems = existing
    .filter((item) => item.source === "Task")
    .map((item) => ({
      clientCase: item.clientCase,
      details: item.details,
      remarks: item.remarks,
      date: item.date
    }));

  let created = 0;
  let skipped = 0;
  let chargesPosted = 0;
  let soasSent = 0;
  const errors: string[] = [];
  const touched: string[] = [];
  const planned: string[] = [];

  for (const client of clients) {
    const retainer = resolveRetainerDetails(client);
    if (!retainer) continue;

    const dueDay = Math.min(28, Math.max(1, Number(retainer.dueDay) || 1));
    const cycle = normalizeRetainerBillingCycle(retainer.billingCycle);
    const billingDate = nextRetainerBillingDateYmd(cycle, dueDay, new Date(`${today}T12:00:00`));
    if (billingDate !== today) {
      skipped++;
      continue;
    }

    const fee = Number(retainer.retainerFee) || 0;
    let chargeOk = !retainer.autoMonthlyBilling;
    let soaOk = !retainer.autoSoaOnDueDate;

    if (retainer.autoMonthlyBilling) {
      if (fee <= 0) {
        errors.push(`${client.code}: monthly fee not set — skipped auto charge`);
        await enqueueBillingOpsAlert(accessToken, {
          kind: "retainer",
          clientCode: client.code,
          title: `Retainer billing blocked — set monthly fee`,
          meta: today,
          markerKey: `${periodKey}:fee-missing`
        }).catch(() => null);
      } else {
        try {
          const ledger = await getClientLedger(accessToken, client.code);
          if (ledgerHasRetainerMonthlyCharge(ledger.entries, client.code, periodKey)) {
            chargeOk = true;
            if (dryRun) planned.push(`${client.code}: charge already posted for ${periodKey}`);
          } else {
            const dueDay = Math.min(28, Math.max(1, Number(retainer.dueDay) || 1));
            const description = retainerMonthlyChargeDescription({
              clientCode: client.code,
              periodKey,
              fee,
              billingDate: today,
              dueDay,
              coverageNote: summarizePackageCoverage(
                (retainer as RetainerIntakeDetails).package
              )
            });
            const payload = {
              clientCode: client.code,
              type: "Charge" as const,
              date: today,
              category: "Professional Fee",
              description,
              charge: fee
            };
            if (dryRun) {
              planned.push(`${client.code}: would post ${formatPeso(fee)}`);
              chargesPosted++;
              chargeOk = true;
              touched.push(`${client.code} · charged ${formatPeso(fee)} (dry-run)`);
            } else {
              await addLedgerEntry(accessToken, payload);
              await triggerTaskOnCharge(accessToken, payload).catch(() => null);
              await appendAuditLog(accessToken, {
                user: auditUser,
                action: "retainer.billing.charge",
                clientCode: client.code,
                summary: `Posted monthly retainer ${formatPeso(fee)} for ${periodKey}`,
                details: description
              }).catch(() => null);
              await enqueueBillingOpsAlert(accessToken, {
                kind: "retainer",
                clientCode: client.code,
                title: `Retainer fee posted — ${formatPeso(fee)}`,
                meta: today,
                markerKey: `${periodKey}:charged`
              }).catch(() => null);
              chargesPosted++;
              chargeOk = true;
              touched.push(`${client.code} · charged ${formatPeso(fee)}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${client.code}: charge failed — ${message}`);
          await enqueueBillingOpsAlert(accessToken, {
            kind: "retainer",
            clientCode: client.code,
            title: `Retainer charge failed — ${message.slice(0, 80)}`,
            meta: today,
            markerKey: `${periodKey}:charge-fail`
          }).catch(() => null);
        }
      }
    }

    if (retainer.autoSoaOnDueDate) {
      try {
        const lastSoa = await getLastSentSoa(accessToken, client.code);
        if (lastSoa && soaAlreadySentOnDate(lastSoa.timestamp, today)) {
          soaOk = true;
        } else {
          if (!String(client.email || "").trim()) {
            errors.push(`${client.code}: SOA failed — no Master contact email`);
            await enqueueBillingOpsAlert(accessToken, {
              kind: "retainer",
              clientCode: client.code,
              title: `Retainer SOA blocked — add contact email`,
              meta: today,
              markerKey: `${periodKey}:email-missing`
            }).catch(() => null);
          } else {
          if (dryRun) {
            planned.push(
              `${client.code}: would email SOA to ${client.email}${String(client.email || "").trim() ? "" : " (MISSING)"}`
            );
            soasSent++;
            soaOk = true;
            touched.push(`${client.code} · SOA emailed (dry-run)`);
          } else {
          const result = await issueSoaHeadlessForClient(accessToken, {
            clientCode: client.code,
            preferredGreeting: "",
            deliveryAction: "Send Now",
            includePortalLink: true,
            auditUser,
            forceRetainer: true
          });
          if (result.ok) {
            soasSent++;
            soaOk = true;
            touched.push(`${client.code} · SOA emailed`);
            await appendAuditLog(accessToken, {
              user: auditUser,
              action: "retainer.billing.soa",
              clientCode: client.code,
              summary: result.message,
              details: result.invoiceNumber || periodKey
            }).catch(() => null);
            await enqueueBillingOpsAlert(accessToken, {
              kind: "retainer",
              clientCode: client.code,
              title: `Retainer SOA emailed`,
              meta: today,
              markerKey: `${periodKey}:soa-sent`
            }).catch(() => null);
          } else {
            errors.push(`${client.code}: SOA failed — ${result.message}`);
            await enqueueBillingOpsAlert(accessToken, {
              kind: "retainer",
              clientCode: client.code,
              title: `Retainer SOA failed — ${result.message.slice(0, 80)}`,
              meta: today,
              markerKey: `${periodKey}:soa-fail`
            }).catch(() => null);
          }
          }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${client.code}: SOA failed — ${message}`);
        await enqueueBillingOpsAlert(accessToken, {
          kind: "retainer",
          clientCode: client.code,
          title: `Retainer SOA failed — ${message.slice(0, 80)}`,
          meta: today,
          markerKey: `${periodKey}:soa-fail`
        }).catch(() => null);
      }
    }

    // Fallback staff tasks only when automation did not fully succeed.
    if (dryRun) {
      skipped++;
      continue;
    }
    const needBillingTask = retainer.autoMonthlyBilling && !chargeOk;
    const needSoaTask = retainer.autoSoaOnDueDate && !soaOk;
    if (!needBillingTask && !needSoaTask) {
      skipped++;
      continue;
    }

    const clientCase = formatClientCaseLabel(
      client.name,
      matterTypeCaseLabel(
        resolveClientMatterType({
          matterType: client.matterType,
          caseTitle: client.caseTitle,
          retainerBalance: client.retainerBalance
        }),
        client.caseTitle
      )
    );
    const tasks = buildRetainerBillingTasks(
      clientCase,
      client.assignedAttorney?.trim() || "Unassigned",
      today,
      {
        ...retainer,
        autoMonthlyBilling: needBillingTask,
        autoSoaOnDueDate: needSoaTask
      }
    );

    for (const task of tasks) {
      const dueDate = String(task.dueDate || "").slice(0, 10);
      if (dueDate !== today) continue;
      const description = String(task.description || "").trim();
      if (taskExists(taskItems, task.clientCase, description, dueDate)) {
        skipped++;
        continue;
      }
      const kind = description.toLowerCase().includes("soa") ? "soa" : "billing";
      const marker = retainerBillingAutopilotMarker(client.code, dueDate, kind);
      const failNote = errors.filter((row) => row.startsWith(`${client.code}:`)).join(" ");
      const saved = await appendTask(
        accessToken,
        {
          ...task,
          remarks: `${task.remarks || ""}\n${marker}${failNote ? `\nAuto failed: ${failNote}` : ""}`.trim()
        },
        { createdBy: auditUser }
      );
      taskItems.push({
        clientCase: task.clientCase,
        details: description,
        remarks: marker,
        date: dueDate
      });
      created++;
      touched.push(`${client.code} · task ${saved.id}`);
    }
  }

  if (created) invalidateTasksDataCache(accessToken);
  return {
    created,
    skipped,
    chargesPosted,
    soasSent,
    errors,
    clients: touched,
    dryRun: dryRun || undefined,
    planned: planned.length ? planned : undefined
  };
}
