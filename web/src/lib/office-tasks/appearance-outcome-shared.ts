import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Categories that use the “What happened” outcome dialog instead of plain Next. */
export const APPEARANCE_OUTCOME_CATEGORIES = ["Hearing", "Meeting", "Consultation"] as const;

export type AppearanceOutcomeAction = "completed" | "rescheduled" | "postponed" | "cancelled";

/** Court- or meeting-required next work after logging what happened. */
export type AppearanceCourtFollowUpKind = "none" | "next_hearing" | "submission" | "other";

export const APPEARANCE_COURT_FOLLOW_UP_KINDS: Array<{
  id: AppearanceCourtFollowUpKind;
  label: string;
  hint: string;
}> = [
  { id: "none", label: "None for now", hint: "Outcome only — no extra task or next setting." },
  {
    id: "next_hearing",
    label: "Follow-up hearing",
    hint: "Court set another setting — add the date if known, or a task to confirm it."
  },
  {
    id: "submission",
    label: "Follow-up submission",
    hint: "Pleadings, compliance, or other filing the court required."
  },
  {
    id: "other",
    label: "Other follow-up",
    hint: "Client update, coordination, or anything else that must happen next."
  }
];

const OUTCOME_ACTION_RE = /\n?EVENT_OUTCOME:(completed|rescheduled|postponed|cancelled)/i;

export function isAppearanceOutcomeEvent(item: Pick<OfficeItem, "source" | "category">): boolean {
  if (item.source !== "Event") return false;
  const category = String(item.category || "").trim();
  if ((APPEARANCE_OUTCOME_CATEGORIES as readonly string[]).includes(category)) return true;
  return /hearing/i.test(category);
}

export function parseAppearanceOutcomeNote(remarks: string): string {
  const eventNote = String(remarks || "").match(/\n?EVENT_OUTCOME_NOTE:([^\n]+)/i)?.[1]?.trim();
  if (eventNote) return eventNote;
  return String(remarks || "").match(/\n?HEARING_OUTCOME_NOTE:([^\n]+)/i)?.[1]?.trim() || "";
}

export function parseAppearanceOutcomeAction(remarks: string): AppearanceOutcomeAction | null {
  const match = String(remarks || "").match(OUTCOME_ACTION_RE);
  const raw = match?.[1]?.toLowerCase();
  if (raw === "completed" || raw === "rescheduled" || raw === "postponed" || raw === "cancelled") {
    return raw;
  }
  return null;
}

export function normalizeAppearanceCourtFollowUpKind(value: unknown): AppearanceCourtFollowUpKind {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "next_hearing" || raw === "submission" || raw === "other") return raw;
  return "none";
}

/** Payload passed from What happened UI into handlers / API. */
export type AppearanceOutcomeLogPayload = {
  action: AppearanceOutcomeAction;
  whatHappened: string;
  nextDate?: string;
  createNextDateFollowUp: boolean;
  courtFollowUpKind?: AppearanceCourtFollowUpKind;
  followUpDate?: string;
  followUpNote?: string;
};
