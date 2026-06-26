import { formatBillingDate } from "@/lib/billing-document-design";
import { normalizeScheduleCategory } from "@/lib/office-tasks/event-form-utils";

type ScheduleLike = {
  category?: string;
  clientCase?: string;
  date?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  platform?: string;
  assignedTo?: string;
  venue?: string;
};

export function formatScheduleTimeRange(startTime?: string | null, endTime?: string | null): string {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "";
}

export function formatScheduleEventDate(item: Pick<ScheduleLike, "date" | "eventDate">): string {
  const ymd = String(item.eventDate || item.date || "").trim();
  return ymd ? formatBillingDate(ymd) : "Date to be confirmed";
}

export function buildScheduleEmailSummary(item: ScheduleLike) {
  const category = normalizeScheduleCategory(item.category || "Meeting");
  const dateLabel = formatScheduleEventDate(item);
  const timeLabel = formatScheduleTimeRange(item.startTime, item.endTime);
  const platform = item.platform?.trim() || "In person";
  const whenLabel = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;

  return {
    category,
    clientCase: item.clientCase?.trim() || "Client matter",
    dateLabel,
    timeLabel,
    whenLabel,
    platform,
    assignedTo: item.assignedTo?.trim() || "",
    venue: item.venue?.trim() || ""
  };
}
