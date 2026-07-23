import "server-only";

import { getClients } from "@/lib/sheets/master";
import {
  formatRetainerDigestOneLiner,
  listRetainerDigestForTomorrow
} from "@/lib/retainer-month-ops";
import { enqueueBillingOpsAlert } from "@/lib/billing-ops-alerts";
import { appendAuditLog, getAuditLog } from "@/lib/sheets/audit-log";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { formatPeso } from "@/lib/gl-config";

const SENT_PREFIX = "RETAINER_DIGEST_SENT";

function digestMarker(dayYmd: string): string {
  return `${SENT_PREFIX}:${dayYmd}`;
}

async function wasDigestSent(accessToken: string, dayYmd: string): Promise<boolean> {
  const marker = digestMarker(dayYmd);
  const entries = await getAuditLog(accessToken, { limit: 150 });
  return entries.some((entry) => entry.details.trim() === marker);
}

function digestRecipients(): string[] {
  const raw =
    process.env.RETAINER_DIGEST_EMAILS?.trim() ||
    process.env.DAILY_DIGEST_EMAILS?.trim() ||
    process.env.ADMIN_EMAILS?.trim() ||
    "";
  return raw
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function sendRetainerEveDigest(
  accessToken: string,
  options?: { today?: string; force?: boolean; recipients?: string[] }
): Promise<{
  sent: number;
  skipped: boolean;
  message: string;
  lines: string[];
  oneLiner: string;
}> {
  const today = options?.today || todayYmd();
  const clients = await getClients(accessToken);
  const rows = listRetainerDigestForTomorrow(clients, { today });
  const oneLiner = formatRetainerDigestOneLiner(rows);
  const lines = rows.map(
    (row) =>
      `${row.clientCode} · ${row.directoryLabel} · ${row.fee > 0 ? formatPeso(row.fee) : "fee unset"} · ${
        row.emailOk ? "email OK" : "ADD EMAIL"
      }`
  );

  if (!rows.length) {
    return {
      sent: 0,
      skipped: true,
      message: "No retainer dues tomorrow.",
      lines: [],
      oneLiner
    };
  }

  // Always surface in ops queue (deduped by marker).
  await enqueueBillingOpsAlert(accessToken, {
    kind: "retainer",
    clientCode: rows[0].clientCode,
    title: oneLiner,
    meta: today,
    markerKey: `eve:${today}`
  }).catch(() => null);

  if (!options?.force && (await wasDigestSent(accessToken, today))) {
    return {
      sent: 0,
      skipped: true,
      message: `Retainer eve digest already sent for ${today}. ${oneLiner}`,
      lines,
      oneLiner
    };
  }

  const recipients =
    options?.recipients?.map((email) => email.trim()).filter(Boolean) || digestRecipients();
  if (!recipients.length) {
    await appendAuditLog(accessToken, {
      user: "cron:retainer-digest",
      action: "retainer.digest.ops_only",
      summary: oneLiner,
      details: digestMarker(today)
    }).catch(() => null);
    return {
      sent: 0,
      skipped: false,
      message: `${oneLiner} (ops alert only — set RETAINER_DIGEST_EMAILS or DAILY_DIGEST_EMAILS to email staff).`,
      lines,
      oneLiner
    };
  }

  const html =
    `<p style="font-family:Georgia,serif;font-size:15px;color:#1a1612;">Retainer dues tomorrow</p>` +
    `<p style="font-family:Georgia,serif;font-size:14px;color:#4a4339;">${oneLiner}</p>` +
    `<ul style="font-family:Georgia,serif;font-size:13px;color:#1a1612;">` +
    lines.map((line) => `<li>${line}</li>`).join("") +
    `</ul>` +
    `<p style="font-family:Georgia,serif;font-size:12px;color:#4a4339;">Confirm Master contact emails are green before midnight autopilot.</p>`;

  await sendHtmlEmailViaGmail({
    accessToken,
    to: recipients.join(", "),
    subject: oneLiner.slice(0, 120),
    html,
    plain: `${oneLiner}\n\n${lines.join("\n")}`
  });

  await appendAuditLog(accessToken, {
    user: "cron:retainer-digest",
    action: "retainer.digest.sent",
    summary: oneLiner,
    details: digestMarker(today)
  });

  return {
    sent: 1,
    skipped: false,
    message: `Retainer eve digest emailed to ${recipients.join(", ")}. ${oneLiner}`,
    lines,
    oneLiner
  };
}
