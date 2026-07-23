import { readFirmAutomationSettings } from "@/lib/firm-automation-settings";
import { reconcileLinkedPrepTaskAssignees, reconcilePleadingEventsAssignedToPrepStaff } from "@/lib/office-tasks/event-client-attorney";
import { reconcileDuplicateEventLinkedTasks } from "@/lib/office-tasks/event-follow-up";
import { reconcilePostHearingFollowUps } from "@/lib/office-tasks/hearing-follow-up-automations";
import { repairFollowUpStatusesFromRemarks } from "@/lib/office-tasks/sheets/complete";
import { backfillMissingSourceIds } from "@/lib/office-tasks/sheets/repair-source-ids";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { collapseDuplicateOpenSoaFollowUps, reconcileSoaFollowUpTasks } from "@/lib/soa-follow-up";
import { invalidateCache } from "@/lib/sheets/cache";
import { recordTasksRepairRun } from "@/lib/office-tasks/tasks-repair-log";

export type TasksRepairSource = "today" | "cron" | "admin";

export type TasksRepairCounts = {
  backfillTasks: number;
  backfillEvents: number;
  statusesRepaired: number;
  eventLinkedDeduped: number;
  postHearingCreated: number;
  postHearingDuplicatesClosed: number;
  soaFollowUpsClosed: number;
  soaDuplicatesClosed: number;
  pleadingEventsReassigned: number;
  prepTasksReassigned: number;
};

export type TasksRepairResult = {
  source: TasksRepairSource;
  at: string;
  counts: TasksRepairCounts;
  message: string | null;
  error: string | null;
};

export function emptyTasksRepairCounts(): TasksRepairCounts {
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

export function totalTasksRepairMutations(counts: TasksRepairCounts): number {
  return (
    counts.backfillTasks +
    counts.backfillEvents +
    counts.statusesRepaired +
    counts.eventLinkedDeduped +
    counts.postHearingCreated +
    counts.postHearingDuplicatesClosed +
    counts.soaFollowUpsClosed +
    counts.soaDuplicatesClosed +
    counts.pleadingEventsReassigned +
    counts.prepTasksReassigned
  );
}

export function formatTasksRepairReceipt(counts: TasksRepairCounts): string | null {
  const parts: string[] = [];
  if (counts.postHearingCreated > 0) {
    parts.push(
      `added ${counts.postHearingCreated} post-hearing follow-up${counts.postHearingCreated === 1 ? "" : "s"}`
    );
  }
  if (counts.postHearingDuplicatesClosed > 0) {
    parts.push(
      `closed ${counts.postHearingDuplicatesClosed} duplicate follow-up${counts.postHearingDuplicatesClosed === 1 ? "" : "s"}`
    );
  }
  if (counts.eventLinkedDeduped > 0) {
    parts.push(`deduped ${counts.eventLinkedDeduped} event-linked task${counts.eventLinkedDeduped === 1 ? "" : "s"}`);
  }
  if (counts.soaFollowUpsClosed > 0) {
    parts.push(`closed ${counts.soaFollowUpsClosed} stale SOA follow-up${counts.soaFollowUpsClosed === 1 ? "" : "s"}`);
  }
  if (counts.soaDuplicatesClosed > 0) {
    parts.push(`closed ${counts.soaDuplicatesClosed} duplicate SOA follow-up${counts.soaDuplicatesClosed === 1 ? "" : "s"}`);
  }
  if (counts.backfillTasks + counts.backfillEvents > 0) {
    parts.push(`backfilled ${counts.backfillTasks + counts.backfillEvents} row ID${counts.backfillTasks + counts.backfillEvents === 1 ? "" : "s"}`);
  }
  if (counts.statusesRepaired > 0) {
    parts.push(`repaired ${counts.statusesRepaired} follow-up status${counts.statusesRepaired === 1 ? "" : "es"}`);
  }
  if (counts.pleadingEventsReassigned + counts.prepTasksReassigned > 0) {
    parts.push("reassigned prep workload rows");
  }
  if (!parts.length) return null;
  return `Automation: ${parts.join("; ")}.`;
}

function invalidateAfterRepairs(token: string, counts: TasksRepairCounts): void {
  if (totalTasksRepairMutations(counts) <= 0) return;
  invalidateCache(token, "tasks-items");
  invalidateCache(token, "tasks-home");
}

/** Status fixes and closes only — safe when opening Today (no new task rows). */
export async function runReadOnlyTasksRepairs(accessToken: string): Promise<TasksRepairCounts> {
  const backfill = await backfillMissingSourceIds(accessToken);
  const statusesRepaired = await repairFollowUpStatusesFromRemarks(accessToken);
  const eventLinkedDeduped = await reconcileDuplicateEventLinkedTasks(accessToken).catch(() => 0);
  const postHearing = await reconcilePostHearingFollowUps(accessToken, undefined, { createNew: false }).catch(() => ({
    created: 0,
    duplicatesClosed: 0
  }));
  const soaFollowUpsClosed = await reconcileSoaFollowUpTasks(accessToken).catch(() => 0);
  const soaDuplicatesClosed = await collapseDuplicateOpenSoaFollowUps(accessToken).catch(() => 0);
  const pleadingEventsReassigned = await reconcilePleadingEventsAssignedToPrepStaff(accessToken).catch(() => 0);
  const prepTasksReassigned = await reconcileLinkedPrepTaskAssignees(accessToken).catch(() => 0);

  return {
    backfillTasks: backfill.tasks,
    backfillEvents: backfill.events,
    statusesRepaired,
    eventLinkedDeduped,
    postHearingCreated: 0,
    postHearingDuplicatesClosed: postHearing.duplicatesClosed,
    soaFollowUpsClosed,
    soaDuplicatesClosed,
    pleadingEventsReassigned,
    prepTasksReassigned
  };
}

/** Creates post-hearing follow-up tasks for past open hearings (cron / admin). */
export async function runTaskCreatingRepairs(accessToken: string): Promise<TasksRepairCounts> {
  const settings = await readFirmAutomationSettings(accessToken).catch(() => null);
  const counts = await runReadOnlyTasksRepairs(accessToken);

  if (settings?.createPostHearingFollowUpTask) {
    const postHearing = await reconcilePostHearingFollowUps(accessToken, undefined, {
      createNew: true,
      skipDuplicateCollapse: true
    }).catch(() => ({ created: 0, duplicatesClosed: 0 }));
    counts.postHearingCreated = postHearing.created;
  }

  return counts;
}

export async function runTasksRepairs(
  accessToken: string,
  source: TasksRepairSource,
  options?: { createTasks?: boolean }
): Promise<TasksRepairResult> {
  try {
    const counts =
      options?.createTasks === true
        ? await runTaskCreatingRepairs(accessToken)
        : await runReadOnlyTasksRepairs(accessToken);
    invalidateAfterRepairs(accessToken, counts);
    const message = formatTasksRepairReceipt(counts);
    const record = await recordTasksRepairRun(accessToken, { source, counts, message });

    if (message && totalTasksRepairMutations(counts) > 0) {
      await appendTaskActivity(accessToken, {
        user: source === "cron" ? "cron" : "automation",
        action: "tasks-repair",
        source: "Task",
        summary: message.replace(/^Automation:\s*/, ""),
        details: JSON.stringify(counts)
      }).catch(() => {});
    }

    return record;
  } catch (error) {
    const counts = emptyTasksRepairCounts();
    const errorMessage = error instanceof Error ? error.message : "Tasks repair failed.";
    const record = await recordTasksRepairRun(accessToken, {
      source,
      counts,
      message: null,
      error: errorMessage
    }).catch(() => ({
      source,
      at: new Date().toISOString(),
      counts,
      message: null,
      error: errorMessage
    }));
    return record;
  }
}
