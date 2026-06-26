import { isFilingPrepItem } from "@/lib/office-tasks/firm-task-groups";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { looksLikePrepReminderTask } from "@/lib/office-tasks/prep-task-event-link";
import { parsePrepChecklistState } from "@/lib/office-tasks/prep-checklist-storage";
import { todayYmd } from "@/lib/office-tasks/schedule";

const PREP_DONE_NOTICE_RE = /PREP_DONE_NOTICE:([^:\n]+):(\d{4}-\d{2}-\d{2})/i;

/** Prep reminder tasks, filing prep category, or tasks carrying an interactive prep checklist. */
export function isPreparationTask(item: Pick<OfficeItem, "source" | "category" | "details" | "remarks">): boolean {
  if (item.source !== "Task") return false;
  if (isFilingPrepItem(item as OfficeItem)) return true;
  if (looksLikePrepReminderTask(item)) return true;
  if (parsePrepChecklistState(item.remarks || "")) return true;
  const haystack = `${item.details} ${item.category}`.toLowerCase();
  return haystack.includes("prep checklist") || haystack.includes("hearing prep") || haystack.includes("filing prep");
}

export function prepDoneNoticeMarker(staffName: string, dateYmd = todayYmd()): string {
  const name = String(staffName || "Staff").trim().replace(/[\n:]/g, " ") || "Staff";
  return `PREP_DONE_NOTICE:${name}:${dateYmd}`;
}

export function parsePrepDoneNotice(remarks: string): { staffName: string; dateYmd: string } | null {
  const match = String(remarks || "").match(PREP_DONE_NOTICE_RE);
  if (!match) return null;
  return { staffName: match[1].trim(), dateYmd: match[2].trim() };
}

export function clearPrepDoneNotice(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?PREP_DONE_NOTICE:[^\n]+/gi, "")
    .trim();
}
