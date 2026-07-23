import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { CRON_JOBS, type CronJobId } from "@/lib/cron-jobs";
import { getLatestCronRuns, type CronRunRecord } from "@/lib/cron-run-log";
import { getLatestTasksRepairRun } from "@/lib/office-tasks/tasks-repair-log";
import { getAppsScriptIntegrationHealth } from "@/lib/apps-script-health";

export type CronJobHealthRow = {
  id: CronJobId;
  label: string;
  scheduleHint: string;
  configured: boolean;
  status: "ok" | "warn" | "error" | "unknown";
  lastRunAt: string | null;
  lastMessage: string | null;
  lastStatus: "ok" | "error" | null;
};

function jobConfigured(job: (typeof CRON_JOBS)[number]): boolean {
  const cronSecret = Boolean(process.env.CRON_SECRET?.trim());
  if (!cronSecret) return false;
  if (job.billingScript && !process.env.APPS_SCRIPT_WEB_APP_URL?.trim()) return false;
  if (job.tasksScript && !process.env.TASKS_APPS_SCRIPT_WEB_APP_URL?.trim()) return false;
  if (job.googleToken && !process.env.CRON_GOOGLE_REFRESH_TOKEN?.trim()) return false;
  return true;
}

function staleDays(lastRunAt: string | null, maxDays: number): boolean {
  if (!lastRunAt) return true;
  const ageMs = Date.now() - Date.parse(lastRunAt);
  return ageMs > maxDays * 86_400_000;
}

function rowStatus(
  job: (typeof CRON_JOBS)[number],
  run: CronRunRecord | undefined
): CronJobHealthRow["status"] {
  if (!jobConfigured(job)) return "warn";
  if (!run) return "unknown";
  if (run.status === "error") return "error";
  if (job.id === "bir-deadlines") {
    return staleDays(run.at, 35) ? "warn" : "ok";
  }
  if (job.id === "partner-weekly") {
    return staleDays(run.at, 8) ? "warn" : "ok";
  }
  if (job.id === "refresh-dashboard") {
    return staleDays(run.at, 0.15) ? "warn" : "ok";
  }
  return staleDays(run.at, 2) ? "warn" : "ok";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!canAccessBilling(email)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  let accessToken: string;
  try {
    accessToken = await requireSessionAccessToken();
  } catch {
    return NextResponse.json({ error: "Could not access firm data." }, { status: 503 });
  }

  const jobIds = CRON_JOBS.map((job) => job.id);
  const [latest, tasksRepair, integrations] = await Promise.all([
    getLatestCronRuns(accessToken, jobIds),
    getLatestTasksRepairRun(accessToken),
    getAppsScriptIntegrationHealth()
  ]);

  const jobs: CronJobHealthRow[] = CRON_JOBS.map((job) => {
    const run = latest[job.id];
    return {
      id: job.id,
      label: job.label,
      scheduleHint: job.scheduleHint,
      configured: jobConfigured(job),
      status: rowStatus(job, run),
      lastRunAt: run?.at || null,
      lastMessage: run?.message || null,
      lastStatus: run?.status || null
    };
  });

  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const integrationsOk = integrations.every((row) => row.ok || !row.configured);
  const allOk = jobs.every((job) => job.status === "ok" || job.status === "unknown") && integrationsOk;

  return NextResponse.json({
    cronConfigured,
    tasksScriptConfigured: integrations.some((row) => row.id === "tasks-apps-script" && row.configured),
    billingScriptConfigured: integrations.some((row) => row.id === "billing-apps-script" && row.configured),
    googleTokenConfigured: Boolean(process.env.CRON_GOOGLE_REFRESH_TOKEN?.trim()),
    integrations,
    overall: !cronConfigured || integrations.some((row) => row.status === "error")
      ? "warn"
      : allOk
        ? "ok"
        : "warn",
    jobs,
    tasksRepair,
    message: !cronConfigured
      ? "Scheduled office jobs are not fully set up yet. Digests and automatic backups may not run."
      : integrations.some((row) => row.status === "error")
        ? "Document automation needs attention — SOA and receipt jobs may not run until it is fixed."
        : integrations.some((row) => row.status === "warn")
          ? "Some office connections need a quick check — see the rows below."
          : allOk
            ? "Automations look good. Green rows ran recently."
            : "Some automations need a quick check — see rows marked amber or red."
  });
}
