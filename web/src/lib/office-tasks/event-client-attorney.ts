import { resolveClientCode } from "@/lib/office-tasks/client-matter";
import { isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import { parsePrepAssignee } from "@/lib/office-tasks/event-item-links";
import { isHandlingLawyerStaff } from "@/lib/office-tasks/handling-lawyer-staff";
import { isFilingPrepItem } from "@/lib/office-tasks/firm-task-groups";
import { isFilingPrepOperationsStaff, responsibleIsFilingPrepStaff } from "@/lib/office-tasks/prep-staff";
import {
  looksLikePrepReminderTask,
  resolveFilingEventForPrepTask
} from "@/lib/office-tasks/prep-task-event-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { defaultFilingPrepAssignees } from "@/lib/office-tasks/task-assignees";
import { findClientForTaskCode } from "@/lib/sheets/master";
import { canonicalizeStaffName } from "@/lib/staff-assignee";
import { SHEETS } from "@/lib/tasks-config";

export { isFilingPrepOperationsStaff, responsibleIsFilingPrepStaff } from "@/lib/office-tasks/prep-staff";

export async function resolveAssignedAttorneyForClientCase(
  accessToken: string,
  clientCase: string
): Promise<string> {
  const label = clientCase.trim();
  if (!label) return "";

  const taskCode = resolveClientCode({ id: "", clientCase: label }) || "";
  if (!taskCode) return "";

  const detail = await findClientForTaskCode(accessToken, taskCode, label);
  return detail?.assignedAttorney?.trim() || "";
}

function normalizePrepAssignees(raw: string, roster: string[]): string {
  return raw
    .split(/[,;]+/)
    .map((name) => canonicalizeStaffName(name.trim(), roster))
    .filter(Boolean)
    .join(", ");
}

function resolvePrepAssigneeFromEvent(
  roster: string[],
  options?: { prepAssignedTo?: string; remarks?: string }
): string {
  const raw =
    options?.prepAssignedTo?.trim() ||
    parsePrepAssignee(options?.remarks || "")?.trim() ||
    defaultFilingPrepAssignees(roster);
  return normalizePrepAssignees(raw, roster);
}

/** Linked court filing events belong on the handling lawyer — not Andrea / Jas. */
export async function resolvePleadingEventResponsible(
  accessToken: string,
  clientCase: string,
  currentResponsible: string,
  roster: string[]
): Promise<string> {
  const attorney = await resolveAssignedAttorneyForClientCase(accessToken, clientCase);
  const fallback = attorney ? canonicalizeStaffName(attorney, roster) : currentResponsible.trim();
  if (!fallback) return currentResponsible.trim();

  const current = currentResponsible.trim();
  if (!current || responsibleIsFilingPrepStaff(current, roster)) {
    return fallback;
  }
  if (isHandlingLawyerStaff(current, roster)) {
    return current;
  }
  return fallback;
}

export async function ensurePleadingEventAssignedToAttorney(
  accessToken: string,
  event: Pick<OfficeItem, "source" | "rowNumber" | "category" | "clientCase" | "assignedTo">,
  roster: string[]
): Promise<string | null> {
  if (event.source !== "Event" || event.rowNumber < 2) return null;
  if (!isPleadingCategory(event.category)) return null;

  const current = event.assignedTo.trim();
  if (current && !responsibleIsFilingPrepStaff(current, roster)) return null;

  const attorney = await resolveAssignedAttorneyForClientCase(accessToken, event.clientCase);
  if (!attorney) return null;

  const normalizedAttorney = canonicalizeStaffName(attorney, roster);
  if (normalizedAttorney === current) return null;

  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `H${event.rowNumber}`), [[normalizedAttorney]]);
  return normalizedAttorney;
}

export async function ensurePleadingEventAssignedToAttorneyById(
  accessToken: string,
  eventId: string,
  roster?: string[]
): Promise<string | null> {
  const names = roster ?? (await getActiveEmployeeNames(accessToken));
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event) return null;
  return ensurePleadingEventAssignedToAttorney(accessToken, event, names);
}

/** Backfill: move open pleading events off Andrea / Jas onto the case attorney. */
export async function reconcilePleadingEventsAssignedToPrepStaff(accessToken: string): Promise<number> {
  const roster = await getActiveEmployeeNames(accessToken);
  const items = await collectAllItems(accessToken);
  let updated = 0;

  for (const item of items) {
    if (item.source !== "Event" || item.done) continue;
    const attorney = await ensurePleadingEventAssignedToAttorney(accessToken, item, roster);
    if (attorney) updated += 1;
  }

  return updated;
}

/** Backfill: move linked filing prep tasks off the handling lawyer onto Andrea / Jas. */
export async function reconcileLinkedPrepTaskAssignees(accessToken: string): Promise<number> {
  const roster = await getActiveEmployeeNames(accessToken);
  const items = await collectAllItems(accessToken);
  let updated = 0;

  for (const task of items) {
    if (task.source !== "Task" || task.done) continue;
    if (!looksLikePrepReminderTask(task) && !isFilingPrepItem(task)) continue;

    const event = resolveFilingEventForPrepTask(task, items);
    if (!event || !isPleadingCategory(event.category)) continue;

    const normalized = resolvePrepAssigneeFromEvent(roster, { remarks: event.remarks || "" });
    if (!normalized) continue;

    const current = task.assignedTo.trim();
    if (!current || current === normalized) continue;
    if (responsibleIsFilingPrepStaff(current, roster)) continue;

    await updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `H${task.rowNumber}`), [[normalized]]);
    updated += 1;
  }

  return updated;
}
