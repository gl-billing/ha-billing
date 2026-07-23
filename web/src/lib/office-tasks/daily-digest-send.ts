import "server-only";

import { appendAuditLog, getAuditLog } from "@/lib/sheets/audit-log";
import {
  buildDailyDigestContent,
  buildDailyDigestHtml,
  buildDailyDigestPlainText,
  buildDailyDigestSubject,
  getDailyDigestRecipients
} from "@/lib/office-tasks/daily-digest";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { todayYmd } from "@/lib/office-tasks/date-only";

const SENT_PREFIX = "DAILY_DIGEST_SENT";

export function dailyDigestSentMarker(dayYmd: string): string {
  return `${SENT_PREFIX}:${dayYmd}`;
}

export function parseDailyDigestSentMarker(details: string): string | null {
  const match = String(details || "").match(/^DAILY_DIGEST_SENT:(\d{4}-\d{2}-\d{2})$/);
  return match?.[1] ?? null;
}

export async function wasDailyDigestSentToday(
  accessToken: string,
  dayYmd: string
): Promise<boolean> {
  const marker = dailyDigestSentMarker(dayYmd);
  const entries = await getAuditLog(accessToken, { limit: 200 });
  return entries.some((entry) => entry.details.trim() === marker);
}

export async function markDailyDigestSent(accessToken: string, dayYmd: string): Promise<void> {
  await appendAuditLog(accessToken, {
    user: "cron",
    action: "daily_digest.sent",
    summary: `Firm daily digest sent for ${dayYmd}`,
    details: dailyDigestSentMarker(dayYmd)
  });
}

export type SendFirmDailyDigestOptions = {
  /** When true, send even if already logged for this calendar day. */
  force?: boolean;
  /** Override recipients (trial firms use admin email instead of env lists). */
  recipients?: string[];
};

export async function sendFirmDailyDigest(
  accessToken: string,
  options: SendFirmDailyDigestOptions = {}
): Promise<{ sent: number; skipped: boolean; message: string; recipients: string[] }> {
  const today = todayYmd();
  const recipients =
    options.recipients?.map((email) => email.trim().toLowerCase()).filter(Boolean) ||
    getDailyDigestRecipients();

  if (!recipients.length) {
    throw new Error(
      "No daily digest recipients. Set DAILY_DIGEST_EMAILS or ADMIN_EMAILS, or configure the firm admin email."
    );
  }

  if (!options.force && (await wasDailyDigestSentToday(accessToken, today))) {
    return {
      sent: 0,
      skipped: true,
      message: `Daily digest already sent for ${today} — skipped.`,
      recipients
    };
  }

  const items = await collectAllItems(accessToken);
  const content = buildDailyDigestContent(items, today);
  const subject = buildDailyDigestSubject(content);
  const html = buildDailyDigestHtml(content);
  const plain = buildDailyDigestPlainText(content);

  await sendHtmlEmailViaGmail({
    accessToken,
    to: recipients.join(", "),
    subject,
    html,
    plain
  });

  await markDailyDigestSent(accessToken, today);

  return {
    sent: 1,
    skipped: false,
    message: `Firm daily digest sent to ${recipients.join(", ")}.`,
    recipients
  };
}
