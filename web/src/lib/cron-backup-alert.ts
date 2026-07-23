import { FIRM_EMAIL, FIRM_NAME } from "@/lib/billing-document-design";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";

export async function alertOnBackupFailure(accessToken: string | null, errorMessage: string): Promise<void> {
  if (!accessToken) return;
  const to =
    process.env.BACKUP_ALERT_EMAIL?.trim() ||
    process.env.FIRM_SENDER_EMAIL?.trim() ||
    FIRM_EMAIL;
  if (!to) return;

  const subject = `${FIRM_NAME} Office — nightly spreadsheet backup failed`;
  const plain = `The nightly spreadsheet backup cron failed.

Error:
${errorMessage}

Check Vercel cron logs and run a manual backup from Billing → Reports → Maintenance when Apps Script is connected.`;

  const html = `<p>The <strong>nightly spreadsheet backup</strong> cron failed.</p>` +
    `<pre style="white-space:pre-wrap;background:#fef2f2;padding:12px;border-radius:6px;">${errorMessage.replace(/</g, "&lt;")}</pre>` +
    `<p>Check Vercel cron logs and run a manual backup from <strong>Billing → Reports → Maintenance</strong>.</p>`;

  try {
    await sendHtmlEmailViaGmail({
      accessToken,
      to,
      subject,
      html,
      plain
    });
  } catch {
    /* alert is best-effort */
  }
}
