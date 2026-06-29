import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAdminEmails } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  formatAssigneeOverdueEmailHtml,
  formatCourtConfirmationEmailHtml,
  formatEscalationEmailHtml,
  getSecretaryCourtConfirmationItems,
  getEscalationCandidates,
  resolveSecretaryEmployees
} from "@/lib/hearing-escalation";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { getEmployeeItemGroups } from "@/lib/office-tasks/schedule";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";

/** Vercel Cron — hearing escalation + secretary court confirmation (via Apps Script when configured). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isTasksAppsScriptConfigured()) {
    return NextResponse.json(
      { error: "Use Tools → Hearing reminders, or configure TASKS_APPS_SCRIPT for cron." },
      { status: 503 }
    );
  }

  try {
    const result = await callTasksAppsScript("sendHearingReminders", {
      withinDays: 2
    });
    return NextResponse.json({
      ok: true,
      message: result.message || "Hearing reminder job dispatched."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hearing reminder cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const fromEmail = session?.user?.email || undefined;
    const body = (await request.json()) as { scope?: "escalation" | "secretaries" | "andrea" | "both" };
    const scope = body.scope === "andrea" ? "secretaries" : body.scope || "both";
    const today = new Date().toISOString().slice(0, 10);
    const items = await collectAllItems(accessToken);
    const directory = await getEmployeeDirectory(accessToken);
    const sent: string[] = [];

    if (scope === "escalation" || scope === "both") {
      const escalation = getEscalationCandidates(items, today, 2);
      if (escalation.length) {
        const adminEmails = getAdminEmails();
        const assignees = new Set(escalation.map((i) => i.assignedTo).filter(Boolean));
        for (const name of assignees) {
          const employee = directory.find((e) => e.name === name);
          const to = employee?.email || adminEmails[0];
          if (!to) continue;
          const mine = escalation.filter((i) => i.assignedTo === name);
          await sendHtmlEmailViaGmail({
            accessToken,
            fromEmail,
            to,
            subject: `Due within 48h — ${mine.length} hearing/deadline item(s)`,
            html: formatEscalationEmailHtml(mine, 2)
          });
          sent.push(to);
        }
      }
    }

    if (scope === "secretaries" || scope === "both") {
      const pending = getSecretaryCourtConfirmationItems(items);
      const secretaries = resolveSecretaryEmployees(directory);
      const roster = directory.map((employee) => employee.name).filter(Boolean);

      for (const secretary of secretaries) {
        const secretaryEmail = secretary.email.trim().toLowerCase();
        if (!secretaryEmail) continue;

        const secretaryOverdue = getEmployeeItemGroups(secretary.name, items, today, [], roster).overdue;
        if (!pending.length && !secretaryOverdue.length) continue;

        const overdueBlock = formatAssigneeOverdueEmailHtml(secretary.name, secretaryOverdue);
        const courtBlock = pending.length
          ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Please call each court below to confirm the scheduled hearing date and time.</p>` +
            formatCourtConfirmationEmailHtml(pending) +
            `<p style="margin:12px 0 0;font-size:14px;line-height:1.5;">After confirming, mark remarks with court confirmation in the Tasks app.</p>`
          : `<p style="margin:0;font-size:14px;line-height:1.5;">No new court confirmations today.</p>`;

        const subject =
          secretaryOverdue.length && pending.length
            ? `Clear ${secretaryOverdue.length} overdue + call court (${pending.length} hearing${pending.length === 1 ? "" : "s"})`
            : secretaryOverdue.length
              ? `Clear ${secretaryOverdue.length} overdue task${secretaryOverdue.length === 1 ? "" : "s"} first`
              : `Call court to confirm — ${pending.length} scheduled hearing(s)`;

        await sendHtmlEmailViaGmail({
          accessToken,
          fromEmail,
          to: secretaryEmail,
          bcc:
            secretaryOverdue.length >= 5
              ? getAdminEmails().filter((email) => email !== secretaryEmail).join(", ") || undefined
              : undefined,
          subject,
          html:
            `<p>Hi ${secretary.name},</p>` +
            overdueBlock +
            (secretaryOverdue.length
              ? `<h3 style="margin:24px 0 8px;font-size:16px;color:#1a1612;">Then — court confirmations</h3>`
              : "") +
            courtBlock
        });
        sent.push(secretaryEmail);
      }
    }

    return NextResponse.json({
      ok: true,
      message: sent.length
        ? `Reminder email sent to ${sent.join(", ")}.`
        : "No reminders needed right now.",
      recipients: sent
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send hearing reminders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
