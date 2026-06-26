import { invalidateCache, withCache } from "@/lib/sheets/cache";
import { reconcileLinkedPrepTaskAssignees, reconcilePleadingEventsAssignedToPrepStaff } from "@/lib/office-tasks/event-client-attorney";
import { reconcileDuplicateEventLinkedTasks } from "@/lib/office-tasks/event-follow-up";
import { repairFollowUpStatusesFromRemarks } from "@/lib/office-tasks/sheets/complete";
import {
  assertTasksWorkbookSheets,
  listSheetTitles
} from "@/lib/office-tasks/sheets/client";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { backfillMissingSourceIds } from "@/lib/office-tasks/sheets/repair-source-ids";
import { collapseDuplicateOpenSoaFollowUps, reconcileSoaFollowUpTasks } from "@/lib/soa-follow-up";
import { SHEETS } from "@/lib/tasks-config";

const ITEMS_TTL_MS = 45_000;
const EMPLOYEES_TTL_MS = 5 * 60_000;
const SHEET_TITLES_TTL_MS = 5 * 60_000;
const HOME_TTL_MS = 30_000;
const REPAIR_TTL_MS = 5 * 60_000;
const HUB_SUMMARY_TTL_MS = 45_000;
const HEALTH_TTL_MS = 2 * 60_000;

export function invalidateTasksDataCache(token: string): void {
  invalidateCache(token, "tasks-items");
  invalidateCache(token, "tasks-employees");
  invalidateCache(token, "tasks-home");
  invalidateCache(token, "tasks-repairs-done");
  invalidateCache(token, "office-hub-summary");
  invalidateCache(token, "health-checks");
}

export async function getCachedAllItems(token: string, fresh = false) {
  if (fresh) return collectAllItems(token);
  return withCache(token, "tasks-items", ITEMS_TTL_MS, () => collectAllItems(token));
}

export async function getCachedEmployeeDirectory(token: string) {
  return withCache(token, "tasks-employees", EMPLOYEES_TTL_MS, () => getEmployeeDirectory(token));
}

/** Cached sheet tab list — avoids spreadsheets.get on every tasks home load. */
async function getCachedTasksSheetTitles(token: string): Promise<string[]> {
  return withCache(token, "tasks-sheet-titles", SHEET_TITLES_TTL_MS, () => listSheetTitles(token));
}

export async function assertTasksWorkbookSheetsCached(token: string): Promise<void> {
  const required = [SHEETS.tasks, SHEETS.events, SHEETS.employees] as const;
  const titles = await getCachedTasksSheetTitles(token);
  const missing = required.filter((name) => !titles.includes(name));
  if (!missing.length) return;
  await assertTasksWorkbookSheets(token);
}

/** Auto-repair runs at most once every 5 minutes per user (not on every refresh). */
export async function runThrottledAutoRepairs(token: string): Promise<void> {
  await withCache(token, "tasks-repairs-done", REPAIR_TTL_MS, async () => {
    const backfill = await backfillMissingSourceIds(token);
    const repaired = await repairFollowUpStatusesFromRemarks(token);
    const eventLinkedDeduped = await reconcileDuplicateEventLinkedTasks(token).catch(() => 0);
    const soaFollowUpsClosed = await reconcileSoaFollowUpTasks(token).catch(() => 0);
    const soaDuplicatesClosed = await collapseDuplicateOpenSoaFollowUps(token).catch(() => 0);
    const pleadingEventsReassigned = await reconcilePleadingEventsAssignedToPrepStaff(token).catch(() => 0);
    const prepTasksReassigned = await reconcileLinkedPrepTaskAssignees(token).catch(() => 0);
    if (
      backfill.tasks +
        backfill.events +
        repaired +
        eventLinkedDeduped +
        soaFollowUpsClosed +
        soaDuplicatesClosed +
        pleadingEventsReassigned +
        prepTasksReassigned >
      0
    ) {
      invalidateCache(token, "tasks-items");
      invalidateCache(token, "tasks-home");
    }
    return true;
  });
}

export async function withCachedTasksHome<T>(
  token: string,
  searchQuery: string,
  loader: () => Promise<T>,
  fresh = false
): Promise<T> {
  if (fresh) return loader();
  const key = searchQuery ? `tasks-home:q:${searchQuery}` : "tasks-home";
  return withCache(token, key, HOME_TTL_MS, loader);
}

export async function withCachedOfficeHubSummary<T>(
  token: string,
  loader: () => Promise<T>
): Promise<T> {
  return withCache(token, "office-hub-summary", HUB_SUMMARY_TTL_MS, loader);
}

export async function withCachedHealthChecks<T>(token: string, loader: () => Promise<T>): Promise<T> {
  return withCache(token, "health-checks", HEALTH_TTL_MS, loader);
}
