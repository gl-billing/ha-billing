/**
 * Matter health / urgency helpers used by desk checklist, filing proof, and hearing cron.
 * Slim port from GL — only the exports HA needs (no full intake-gate stack).
 */

import { isHearingItem } from "@/lib/hearing-escalation";
import { matterItemAnchorId } from "@/lib/office-tasks/client-matter";
import { hasFileProofDone, hasFileProofPending, hasPostHearingFollowUpDone } from "@/lib/office-tasks/event-item-links";
import { getFollowUpFromRemarks } from "@/lib/office-tasks/follow-up-marker";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { normalizeOfficeStatus, todayYmd } from "@/lib/office-tasks/date-only";
import { postHearingFollowUpTasksForEvent } from "@/lib/office-tasks/post-hearing-follow-up-match";
import { parsePrepChecklistState, prepChecklistProgress } from "@/lib/office-tasks/prep-checklist-storage";
import { isCancelledStatus, isItemOpen } from "@/lib/office-tasks/schedule";

export type FilingProofWarning = {
  itemId: string;
  anchorId: string;
  clientCase: string;
  filingLabel: string;
  message: string;
};

export type WaitingClientChip = {
  label: string;
  sinceYmd: string;
  escalated: boolean;
};

export type PostHearingWarning = {
  itemId: string;
  anchorId: string;
  assignee: string;
  clientCase: string;
  hearingDate: string;
  title: string;
  message: string;
};

function prepPercent(event: OfficeItem): number | null {
  const state = parsePrepChecklistState(event.remarks || "");
  if (!state) return null;
  const { done, total } = prepChecklistProgress(state);
  if (!total) return null;
  return Math.round((done / total) * 100);
}

export function computePostHearingWarnings(
  events: OfficeItem[],
  today = todayYmd(),
  allItems: OfficeItem[] = []
): PostHearingWarning[] {
  const warnings: PostHearingWarning[] = [];
  const pool = allItems.length ? allItems : events;

  for (const event of events) {
    if (!isHearingItem(event) || isCancelledStatus(event.status)) continue;
    const hearingDate = (event.eventDate || event.date || "").trim();
    if (!hearingDate || hearingDate >= today) continue;
    if (hasPostHearingFollowUpDone(event.remarks || "", event.id)) continue;
    if (postHearingFollowUpTasksForEvent(pool, event).length > 0) continue;
    if (event.done || normalizeOfficeStatus(event.status) === "Done") continue;

    const assignee = event.assignedTo?.trim() || "Unassigned";
    warnings.push({
      itemId: event.id,
      anchorId: matterItemAnchorId(event),
      assignee,
      clientCase: event.clientCase,
      hearingDate,
      title: event.details.trim().slice(0, 80) || "Hearing",
      message: `Hearing on ${hearingDate} — log the outcome, next date, or cancel the event.`
    });
  }

  return warnings;
}

export function computeFilingProofWarnings(events: OfficeItem[]): FilingProofWarning[] {
  const warnings: FilingProofWarning[] = [];

  for (const event of events) {
    if (event.source !== "Event" || event.done) continue;
    if (!hasFileProofPending(event.remarks || "", event.id)) continue;
    if (hasFileProofDone(event.remarks || "", event.id)) continue;

    warnings.push({
      itemId: event.id,
      anchorId: matterItemAnchorId(event),
      clientCase: event.clientCase,
      filingLabel: event.details.trim().slice(0, 80) || "Filing",
      message: "Upload stamped copy or OR — proof of filing is still pending."
    });
  }

  return warnings;
}

export function getWaitingClientChip(
  status: string,
  remarks: string,
  itemDate: string | null | undefined,
  today = todayYmd(),
  escalateAfterDays = 14
): WaitingClientChip | null {
  const normalized = normalizeOfficeStatus(status);
  if (normalized !== "Waiting" && normalized !== "Started") return null;
  if (!getFollowUpFromRemarks(remarks) && normalized === "Waiting") return null;

  const snoozeMatch = String(remarks || "").match(/Auto-snoozed \+\d+d \((\d{4}-\d{2}-\d{2})\)/i);
  const since = snoozeMatch?.[1] || itemDate?.trim() || today;
  const days = Math.max(
    0,
    Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${since}T12:00:00`)) / 86_400_000)
  );
  return {
    label: normalized === "Waiting" ? "Waiting on client" : "In progress",
    sinceYmd: since,
    escalated: normalized === "Waiting" && days >= escalateAfterDays
  };
}

export function hearingNeedsPrepNudge(event: OfficeItem, today = todayYmd(), withinDays = 3): boolean {
  if (!isItemOpen(event) || !isHearingItem(event)) return false;
  const date = (event.eventDate || event.date || "").trim();
  if (!date) return false;
  const daysUntil = Math.round(
    (Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000
  );
  if (daysUntil < 0 || daysUntil > withinDays) return false;
  const percent = prepPercent(event);
  if (percent === null) return false;
  return percent < 50;
}
