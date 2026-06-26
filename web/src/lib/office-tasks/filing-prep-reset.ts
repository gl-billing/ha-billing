import { addDaysYmd } from "@/lib/office-tasks/date-only";
import { clearPrepDoneNotice } from "@/lib/office-tasks/prep-completion-core";
import {
  createPrepChecklistState,
  nextActionForPrepChecklist,
  parsePrepChecklistState,
  prepChecklistMarker,
  stripPrepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

const PREP_LEAD_DAYS_RE = /this task is due (\d+) days? before/i;
const PREP_DEADLINE_IN_TEXT_RE = /due (\d{4}-\d{2}-\d{2})/i;

export function parsePrepLeadDaysFromDescription(details: string): number | null {
  const match = String(details || "").match(PREP_LEAD_DAYS_RE);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : null;
}

export function inferPrepLeadDaysBefore(
  task: Pick<OfficeItem, "date" | "details">,
  filingDeadline: string
): number {
  const fromText = parsePrepLeadDaysFromDescription(task.details || "");
  if (fromText) return fromText;

  if (task.date && filingDeadline && task.date < filingDeadline) {
    const filingMs = new Date(`${filingDeadline}T12:00:00`).getTime();
    const taskMs = new Date(`${task.date}T12:00:00`).getTime();
    const diff = Math.round((filingMs - taskMs) / (24 * 60 * 60 * 1000));
    if (diff > 0) return diff;
  }

  return 3;
}

export function prepTaskDueDateForFilingDeadline(
  task: Pick<OfficeItem, "date" | "details">,
  filingDeadline: string
): string {
  const leadDays = inferPrepLeadDaysBefore(task, filingDeadline);
  return addDaysYmd(filingDeadline, -leadDays);
}

export function updatePrepTaskDescriptionForDeadline(details: string, filingDeadline: string): string {
  const text = String(details || "");
  if (!text.trim()) return text;
  if (PREP_DEADLINE_IN_TEXT_RE.test(text)) {
    return text.replace(PREP_DEADLINE_IN_TEXT_RE, `due ${filingDeadline}`);
  }
  return text;
}

export function resetPrepTaskRemarks(remarks: string): {
  remarks: string;
  nextAction: string | null;
} {
  const checklist = parsePrepChecklistState(remarks);
  let base = clearPrepDoneNotice(remarks);

  if (!checklist) {
    return { remarks: base, nextAction: null };
  }

  const fresh = createPrepChecklistState(checklist.items);
  base = stripPrepChecklistMarker(base);
  const marker = prepChecklistMarker(fresh);
  return {
    remarks: base ? `${base}\n${marker}` : marker,
    nextAction: nextActionForPrepChecklist(fresh)
  };
}
