import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { resolveClientCode } from "@/lib/office-tasks/client-matter";
import {
  resolveFilingQueueRoute,
  type FilingQueueKind
} from "@/lib/office-tasks/filing-queue-route";
import type { FilingCopyFurnishedParty } from "@/lib/office-tasks/filing-queue-types";
import { createFilingQueueRow } from "@/lib/office-tasks/sheets/filing-queue";
import { getClientDetail } from "@/lib/sheets/master";

type ClientEmailFields = {
  opposingCounselEmail?: string;
  courtEmail?: string;
};

export async function enqueueFilingAfterSubmitted(
  accessToken: string,
  item: OfficeItem,
  options?: { queueOverride?: FilingQueueKind }
): Promise<{ queue: FilingQueueKind; requiresConfirm: boolean; reason: string; created: boolean }> {
  const clientCode = resolveClientCode(item);
  const client = clientCode ? await getClientDetail(accessToken, clientCode).catch(() => null) : null;
  const emailFields = (client || {}) as ClientEmailFields;

  const decision = resolveFilingQueueRoute({
    caseType: client?.caseType,
    pleadingType: item.pleadingType,
    pleadingCaseNature: item.pleadingCaseNature
  });

  const queue = options?.queueOverride || decision.queue;

  const copyFurnished: FilingCopyFurnishedParty[] = [];
  if (emailFields.opposingCounselEmail?.trim()) {
    copyFurnished.push({
      name: "Opposing counsel",
      email: emailFields.opposingCounselEmail.trim()
    });
  }

  await createFilingQueueRow(accessToken, {
    queue,
    eventId: item.id,
    eventRow: item.rowNumber,
    clientCode: client?.code || clientCode || "",
    pleading: item.category?.trim() || "Court submission",
    clientParty: client
      ? [client.caseRole, client.name].filter(Boolean).join(" - ") || client.name
      : item.clientCase || "",
    whereFiled: client?.courtPending || item.venue || "",
    courtAddress: client?.courtPending || item.venue || "",
    courtEmail: emailFields.courtEmail || "",
    copyFurnished,
    manner: queue === "physical" ? item.filingMode || "Registered mail" : "Electronic Filing",
    assignedTo: item.assignedTo || "",
    deadline: item.filingDeadline || item.date || "",
    dateFiled: new Date().toISOString().slice(0, 10),
    clientCaseLabel: item.clientCase || "",
    status: "Queued"
  });

  return { queue, requiresConfirm: decision.requiresConfirm, reason: decision.reason, created: true };
}
