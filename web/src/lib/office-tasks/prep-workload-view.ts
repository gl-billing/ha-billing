import {
  isHearingEventCategory,
  isOpenHearingEvent,
  isPleadingCategory
} from "@/lib/office-tasks/event-form-utils";
import { isHearingChecklistEvent } from "@/lib/office-tasks/prep-checklist-client";
import { isFilingPrepItem } from "@/lib/office-tasks/firm-task-groups";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { isHandlingLawyerStaff } from "@/lib/office-tasks/handling-lawyer-staff";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isFilingPrepOperationsStaff } from "@/lib/office-tasks/prep-staff";
import {
  looksLikePrepReminderTask,
  resolveFilingEventForPrepTask,
  resolvePrepTaskForEvent
} from "@/lib/office-tasks/prep-task-event-link";
import { parsePrepAssignee } from "@/lib/office-tasks/event-item-links";
import { resolveSessionStaffName } from "@/lib/staff-session";
import { formatStaffDisplayName } from "@/lib/user-display";

export type PrepWorkloadViewRole = "prep" | "lawyer" | "neutral";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
};

function eventHasLinkedPrepTask(event: OfficeItem, items: OfficeItem[]): boolean {
  if (event.source !== "Event" || !isPleadingCategory(event.category)) return false;
  return Boolean(resolvePrepTaskForEvent(event, items) || parsePrepAssignee(event.remarks));
}

/** Email-first role — avoids Admin / owner aliases mapping prep staff to the lawyer view. */
export function prepRoleFromLoginEmail(email: string): PrepWorkloadViewRole | null {
  const value = email.trim().toLowerCase();
  if (!value) return null;
  const local = value.split("@")[0] || value;
  if (/shiela|legal|ellyza|andrea|farvjas|jasbrie|hakola|(?<![a-z])jas(?![a-z])|james.*bryan/.test(local)) {
    return "prep";
  }
  if (
    /hernandez|rahernandez|lizparreno|pasagui|janinerose|maria|nikki|nikkigutz|carlos|parreno/.test(local)
  ) {
    return "lawyer";
  }
  return null;
}

function prepRoleFromDisplayText(text: string): PrepWorkloadViewRole | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/\bshiela\b|\bandrea\b|\bellyza\b|\bjas\b|james bryan|hakola/.test(value)) return "prep";
  if (/\brobert\b|\bhernandez\b|\bmaria\b|\bcarlos\b|\bparreno\b|\bpasagui\b/.test(value)) return "lawyer";
  return null;
}

export function resolvePrepWorkloadViewRole(staffName: string, roster: string[] = []): PrepWorkloadViewRole {
  const name = staffName.trim();
  if (!name) return "neutral";
  const effectiveRoster = roster.length ? roster : [name];
  if (isFilingPrepOperationsStaff(name, effectiveRoster)) return "prep";
  if (isHandlingLawyerStaff(name, effectiveRoster)) return "lawyer";
  return "neutral";
}

/** Resolve prep vs lawyer checklist view for the signed-in user (matter page, My Work, etc.). */
export function resolvePrepRoleFromSession(
  user: SessionUser | null | undefined,
  directory: EmployeeRecord[] = []
): PrepWorkloadViewRole {
  const email = user?.email?.trim() || "";
  const fromEmail = prepRoleFromLoginEmail(email);
  if (fromEmail) return fromEmail;

  const roster = directory.map((entry) => entry.name).filter(Boolean);
  const staffName = resolveSessionStaffName(user, directory);
  if (staffName) {
    const fromStaff = resolvePrepWorkloadViewRole(staffName, roster);
    if (fromStaff !== "neutral") return fromStaff;
  }

  const display = [
    user?.displayName,
    formatStaffDisplayName(user?.name, user?.email),
    user?.name
  ]
    .filter(Boolean)
    .join(" ");
  return prepRoleFromDisplayText(display) || "neutral";
}

function isLinkedPrepPairItem(item: OfficeItem, items: OfficeItem[]): boolean {
  if (item.source === "Task" && (looksLikePrepReminderTask(item) || isFilingPrepItem(item))) {
    const event = resolveFilingEventForPrepTask(item, items);
    return Boolean(event && isPleadingCategory(event.category));
  }
  if (item.source === "Event" && isPleadingCategory(item.category)) {
    return eventHasLinkedPrepTask(item, items);
  }
  return false;
}

/** Andrea / Jas: checklist on prep tasks. Janine / Nikki: checklist on court filing events. */
export function shouldShowPrepChecklistForViewer(
  item: OfficeItem,
  items: OfficeItem[],
  role: PrepWorkloadViewRole
): boolean {
  if (item.source === "Event" && isHearingEventCategory(item.category) && isOpenHearingEvent(item)) {
    return true;
  }
  if (isHearingChecklistEvent(item)) return true;

  if (!isLinkedPrepPairItem(item, items)) return true;

  if (role === "prep") {
    return item.source === "Task";
  }
  if (role === "lawyer") {
    return item.source === "Event";
  }
  return true;
}

/** Andrea / Jas: link on court filing events. Janine / Nikki: link on prep tasks. */
export function shouldShowPrepLinkForViewer(
  item: OfficeItem,
  items: OfficeItem[],
  role: PrepWorkloadViewRole
): boolean {
  if (!isLinkedPrepPairItem(item, items)) return false;

  if (role === "prep") {
    return item.source === "Event";
  }
  if (role === "lawyer") {
    return item.source === "Task";
  }
  return item.source === "Event" || item.source === "Task";
}

function itemKey(item: OfficeItem): string {
  return `${item.source}-${item.rowNumber}`;
}

/** Include the linked half of a filing prep pair so each role sees both cards in My Work. */
export function expandStaffWorkloadWithLinkedPrepPairs(
  list: OfficeItem[],
  allItems: OfficeItem[],
  role: PrepWorkloadViewRole
): OfficeItem[] {
  if (role !== "prep" && role !== "lawyer") return list;

  const seen = new Set(list.map(itemKey));
  const extras: OfficeItem[] = [];

  for (const item of list) {
    if (role === "prep" && item.source === "Task" && looksLikePrepReminderTask(item)) {
      const event = resolveFilingEventForPrepTask(item, allItems);
      if (event && !seen.has(itemKey(event))) {
        seen.add(itemKey(event));
        extras.push(event);
      }
    }

    if (role === "lawyer" && item.source === "Event" && isPleadingCategory(item.category)) {
      const prep = resolvePrepTaskForEvent(item, allItems);
      if (prep && !seen.has(itemKey(prep))) {
        seen.add(itemKey(prep));
        extras.push(prep);
      }
    }
  }

  return extras.length ? [...list, ...extras] : list;
}
