import type { CronJobId } from "@/lib/cron-jobs";
import { appendAuditLog, getAuditLog } from "@/lib/sheets/audit-log";

const RUN_PREFIX = "CRON_RUN";
const ALERT_PREFIX = "CRON_FAIL_ALERT";

export type CronRunStatus = "ok" | "error";

export type CronRunRecord = {
  jobId: CronJobId;
  status: CronRunStatus;
  message: string;
  at: string;
};

function runMarker(jobId: CronJobId, status: CronRunStatus, at: string): string {
  return `${RUN_PREFIX}:${jobId}:${status}:${at}`;
}

export function parseCronRunMarker(details: string): CronRunRecord | null {
  const match = String(details || "").match(
    /^CRON_RUN:([a-z0-9-]+):(ok|error):(\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/
  );
  if (!match) return null;
  return {
    jobId: match[1] as CronJobId,
    status: match[2] as CronRunStatus,
    message: "",
    at: match[3]
  };
}

export async function recordCronRun(
  accessToken: string | null,
  jobId: CronJobId,
  status: CronRunStatus,
  message: string
): Promise<void> {
  if (!accessToken) return;
  const at = new Date().toISOString();
  await appendAuditLog(accessToken, {
    user: "cron",
    action: "cron.run",
    summary: `${jobId} — ${status}`,
    details: `${runMarker(jobId, status, at)} | ${message.slice(0, 500)}`
  });
}

export async function getLatestCronRuns(
  accessToken: string,
  jobIds: CronJobId[]
): Promise<Partial<Record<CronJobId, CronRunRecord>>> {
  const entries = await getAuditLog(accessToken, { limit: 800 });
  const latest: Partial<Record<CronJobId, CronRunRecord>> = {};

  for (const entry of entries) {
    if (entry.action !== "cron.run") continue;
    const parsed = parseCronRunMarker(entry.details.split("|")[0]?.trim() || entry.details);
    if (!parsed || !jobIds.includes(parsed.jobId)) continue;
    if (latest[parsed.jobId]) continue;

    const messagePart = entry.details.includes("|")
      ? entry.details.split("|").slice(1).join("|").trim()
      : entry.summary;

    latest[parsed.jobId] = {
      ...parsed,
      message: messagePart || entry.summary
    };
  }

  return latest;
}

/** Count consecutive failures (most recent runs first) for a job. */
export async function countConsecutiveCronFailures(
  accessToken: string,
  jobId: CronJobId,
  maxLookback = 5
): Promise<number> {
  const entries = await getAuditLog(accessToken, { limit: 400 });
  const runs: CronRunStatus[] = [];

  for (const entry of entries) {
    if (entry.action !== "cron.run") continue;
    const parsed = parseCronRunMarker(entry.details.split("|")[0]?.trim() || entry.details);
    if (!parsed || parsed.jobId !== jobId) continue;
    runs.push(parsed.status);
    if (runs.length >= maxLookback) break;
  }

  let streak = 0;
  for (const status of runs) {
    if (status !== "error") break;
    streak += 1;
  }
  return streak;
}

export function cronFailAlertMarker(jobId: CronJobId, dayYmd: string): string {
  return `${ALERT_PREFIX}:${jobId}:${dayYmd}`;
}

export function parseCronFailAlertMarker(details: string): { jobId: CronJobId; dayYmd: string } | null {
  const match = String(details || "").match(/^CRON_FAIL_ALERT:([a-z0-9-]+):(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { jobId: match[1] as CronJobId, dayYmd: match[2] };
}

export async function wasCronFailAlertSentToday(
  accessToken: string,
  jobId: CronJobId,
  dayYmd: string
): Promise<boolean> {
  const marker = cronFailAlertMarker(jobId, dayYmd);
  const entries = await getAuditLog(accessToken, { limit: 200 });
  return entries.some((entry) => entry.details.trim() === marker);
}

export async function markCronFailAlertSent(
  accessToken: string,
  jobId: CronJobId,
  dayYmd: string
): Promise<void> {
  await appendAuditLog(accessToken, {
    user: "cron",
    action: "cron.fail_alert",
    summary: `${jobId} — repeated failure alert sent`,
    details: cronFailAlertMarker(jobId, dayYmd)
  });
}
