import { appendAuditLog, getAuditLog } from "@/lib/sheets/audit-log";
import type { TasksRepairCounts, TasksRepairSource } from "@/lib/office-tasks/tasks-repairs";

const REPAIR_PREFIX = "TASKS_REPAIR_RUN";

export type TasksRepairRunRecord = {
  source: TasksRepairSource;
  at: string;
  counts: TasksRepairCounts;
  message: string | null;
  error: string | null;
};

function repairMarker(source: TasksRepairSource, at: string): string {
  return `${REPAIR_PREFIX}:${source}:${at}`;
}

export function parseTasksRepairMarker(details: string): { source: TasksRepairSource; at: string } | null {
  const match = String(details || "").match(
    /^TASKS_REPAIR_RUN:(today|cron|admin):(\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/
  );
  if (!match) return null;
  return { source: match[1] as TasksRepairSource, at: match[2] };
}

export async function recordTasksRepairRun(
  accessToken: string,
  input: {
    source: TasksRepairSource;
    counts: TasksRepairCounts;
    message: string | null;
    error?: string | null;
  }
): Promise<TasksRepairRunRecord> {
  const at = new Date().toISOString();
  const record: TasksRepairRunRecord = {
    source: input.source,
    at,
    counts: input.counts,
    message: input.message,
    error: input.error || null
  };

  await appendAuditLog(accessToken, {
    user: input.source === "cron" ? "cron" : "tasks-repair",
    action: "tasks.repair",
    summary: input.message || (input.error ? `Tasks repair failed — ${input.error}` : "Tasks repair completed"),
    details: `${repairMarker(input.source, at)} | ${JSON.stringify(record.counts)}${
      input.error ? ` | error:${input.error.slice(0, 200)}` : ""
    }`
  });

  return record;
}

export async function getLatestTasksRepairRun(accessToken: string): Promise<TasksRepairRunRecord | null> {
  const entries = await getAuditLog(accessToken, { limit: 400 });
  for (const entry of entries) {
    if (entry.action !== "tasks.repair") continue;
    const parsed = parseTasksRepairMarker(entry.details.split("|")[0]?.trim() || entry.details);
    if (!parsed) continue;
    let counts: TasksRepairCounts = emptyRepairCounts();
    try {
      const jsonPart = entry.details.split("|")[1]?.trim();
      if (jsonPart) counts = JSON.parse(jsonPart) as TasksRepairCounts;
    } catch {
      /* ignore malformed */
    }
    const errorPart = entry.details.includes("| error:") ? entry.details.split("| error:")[1]?.trim() || null : null;
    return {
      source: parsed.source,
      at: parsed.at,
      counts,
      message: entry.summary || null,
      error: errorPart
    };
  }
  return null;
}

function emptyRepairCounts(): TasksRepairCounts {
  return {
    backfillTasks: 0,
    backfillEvents: 0,
    statusesRepaired: 0,
    eventLinkedDeduped: 0,
    postHearingCreated: 0,
    postHearingDuplicatesClosed: 0,
    soaFollowUpsClosed: 0,
    soaDuplicatesClosed: 0,
    pleadingEventsReassigned: 0,
    prepTasksReassigned: 0
  };
}
