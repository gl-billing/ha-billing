import { isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import { addDaysYmd } from "@/lib/office-tasks/date-only";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

const FILING_CATEGORIES = new Set(["Deadline", "Submission", "Court Filing"]);
const FILING_ALERT_HORIZON_DAYS = 21;

export type FilingDeadlineUrgency = "overdue" | "due-today" | "due-soon" | "confirm-soon";

export type FilingDeadlineAlert = {
  item: OfficeItem;
  urgency: FilingDeadlineUrgency;
  deadline: string;
  needsConfirmation: boolean;
};

export function isFilingDeadlineEvent(item: Pick<OfficeItem, "source" | "category" | "filingDeadline">): boolean {
  if (item.source !== "Event") return false;
  if (!item.filingDeadline?.trim()) return false;
  return isPleadingCategory(item.category) || FILING_CATEGORIES.has(item.category);
}

export function isOpenFilingEvent(
  item: Pick<OfficeItem, "source" | "category" | "filingDeadline" | "status" | "done">
): boolean {
  if (!isFilingDeadlineEvent(item)) return false;
  return !item.done && item.status !== "Submitted" && item.status !== "Done" && item.status !== "Cancelled";
}

/** Show confirm-if-filed from reminder days before deadline until marked submitted. */
export function needsFilingConfirmation(
  item: Pick<OfficeItem, "source" | "category" | "filingDeadline" | "status" | "done" | "reminderDays">,
  todayYmd: string
): boolean {
  if (!isOpenFilingEvent(item)) return false;
  const deadline = item.filingDeadline!.trim();
  const leadDays = Math.max(1, item.reminderDays || 1);
  const showFrom = addDaysYmd(deadline, -leadDays);
  return todayYmd >= showFrom;
}

function urgencyRank(urgency: FilingDeadlineUrgency): number {
  if (urgency === "overdue") return 0;
  if (urgency === "due-today") return 1;
  if (urgency === "confirm-soon") return 2;
  return 3;
}

export function filingDeadlineUrgency(
  item: Pick<OfficeItem, "source" | "category" | "filingDeadline" | "status" | "done" | "reminderDays">,
  todayYmd: string
): FilingDeadlineUrgency | null {
  if (!isOpenFilingEvent(item)) return null;

  const deadline = item.filingDeadline!.trim();
  if (!deadline) return null;

  if (deadline < todayYmd) return "overdue";
  if (deadline === todayYmd) return "due-today";

  const leadDays = Math.max(1, item.reminderDays || 1);
  const showFrom = addDaysYmd(deadline, -leadDays);
  if (todayYmd >= showFrom) return "confirm-soon";

  const horizon = addDaysYmd(todayYmd, FILING_ALERT_HORIZON_DAYS);
  if (deadline <= horizon) return "due-soon";

  return null;
}

export function listFilingDeadlineAlerts(items: OfficeItem[], todayYmd: string): FilingDeadlineAlert[] {
  const alerts: FilingDeadlineAlert[] = [];

  for (const item of items) {
    const urgency = filingDeadlineUrgency(item, todayYmd);
    if (!urgency) continue;
    alerts.push({
      item,
      urgency,
      deadline: item.filingDeadline!.trim(),
      needsConfirmation: needsFilingConfirmation(item, todayYmd)
    });
  }

  return alerts.sort((a, b) => {
    const rank = urgencyRank(a.urgency) - urgencyRank(b.urgency);
    if (rank !== 0) return rank;
    return a.deadline.localeCompare(b.deadline);
  });
}

/** @deprecated Use listFilingDeadlineAlerts */
export function listFilingConfirmations(items: OfficeItem[], todayYmd: string): OfficeItem[] {
  return listFilingDeadlineAlerts(items, todayYmd)
    .filter((alert) => alert.needsConfirmation)
    .map((alert) => alert.item);
}

export function filingDeadlineBadgeLabel(urgency: FilingDeadlineUrgency, deadline: string): string {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "due-today") return "Due today";
  if (urgency === "confirm-soon") return "Confirm filing";
  return `Due ${deadline}`;
}

export function filingConfirmationLabel(
  item: Pick<OfficeItem, "filingDeadline" | "category">,
  todayYmd: string
): string {
  const deadline = item.filingDeadline?.trim() || "";
  if (deadline && deadline < todayYmd) {
    return `Deadline was ${deadline} — confirm if this was already filed or submitted.`;
  }
  if (deadline && deadline === todayYmd) {
    return `Deadline is today — file or submit, then confirm here once done.`;
  }
  return `File by ${deadline}. Confirm here once filed or submitted (no extra task created).`;
}

export function filingConfirmationSummary(
  item: Pick<OfficeItem, "clientCase" | "category" | "filingDeadline" | "details">,
  todayYmd: string
): string {
  const deadline = item.filingDeadline?.trim() || "";
  const matter = item.clientCase?.trim() || "Client matter";
  const kind = item.category?.trim() || "Filing";
  if (deadline && deadline < todayYmd) {
    return `${matter} · ${kind}`;
  }
  if (deadline && deadline === todayYmd) {
    return `${matter} · ${kind}`;
  }
  return `${matter} · ${kind}`;
}

export function filingAlertHeadline(alerts: FilingDeadlineAlert[]): string {
  const overdue = alerts.filter((alert) => alert.urgency === "overdue").length;
  const dueToday = alerts.filter((alert) => alert.urgency === "due-today").length;
  const confirmSoon = alerts.filter((alert) => alert.urgency === "confirm-soon").length;
  const dueSoon = alerts.filter((alert) => alert.urgency === "due-soon").length;

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  if (confirmSoon > 0) parts.push(`${confirmSoon} to confirm`);
  if (dueSoon > 0) parts.push(`${dueSoon} coming up`);

  if (!parts.length) return `${alerts.length} filing deadline${alerts.length === 1 ? "" : "s"}`;
  return parts.join(" · ");
}
