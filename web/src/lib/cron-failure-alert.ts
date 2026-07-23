import type { CronJobId } from "@/lib/cron-jobs";
import { cronJobById } from "@/lib/cron-jobs";
import { FIRM_EMAIL, FIRM_NAME } from "@/lib/billing-document-design";
import {
  countConsecutiveCronFailures,
  markCronFailAlertSent,
  wasCronFailAlertSentToday
} from "@/lib/cron-run-log";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function alertOnRepeatedCronFailure(
  accessToken: string | null,
  jobId: CronJobId,
  errorMessage: string,
  consecutiveThreshold = 2
): Promise<void> {
  if (!accessToken) return;

  const streak = await countConsecutiveCronFailures(accessToken, jobId);
  if (streak < consecutiveThreshold) return;

  const dayYmd = todayUtcYmd();
  if (await wasCronFailAlertSentToday(accessToken, jobId, dayYmd)) return;

  const job = cronJobById(jobId);
  const label = job?.label || jobId;
  const to =
    process.env.CRON_ALERT_EMAIL?.trim() ||
    process.env.BACKUP_ALERT_EMAIL?.trim() ||
    process.env.FIRM_SENDER_EMAIL?.trim() ||
    FIRM_EMAIL;
  if (!to) return;

  const subject = `${FIRM_NAME} Office — cron failed ${streak}× (${label})`;
  const plain = `The scheduled job "${label}" (${jobId}) has failed ${streak} run(s) in a row.

Latest error:
${errorMessage}

Check Billing → Reports → Automation health, or Vercel cron logs for ${jobId}.`;

  const html =
    `<p>The scheduled job <strong>${label}</strong> (<code>${jobId}</code>) has failed ` +
    `<strong>${streak}</strong> run(s) in a row.</p>` +
    `<pre style="white-space:pre-wrap;background:#fef2f2;padding:12px;border-radius:6px;">${errorMessage.replace(/</g, "&lt;")}</pre>` +
    `<p>Check <strong>Billing → Reports → Automation health</strong> or Vercel cron logs.</p>`;

  try {
    await sendHtmlEmailViaGmail({ accessToken, to, subject, html, plain });
    await markCronFailAlertSent(accessToken, jobId, dayYmd);
  } catch {
    /* best-effort */
  }
}
