import { addDaysYmd, todayYmd } from "@/lib/office-tasks/date-only";
import type { CaseOption } from "@/lib/gl-config";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

export type EventAddKind = "appearances" | "filings";

export const EVENT_ADD_KIND_LABELS: Record<EventAddKind, string> = {
  appearances: "Hearings & meetings",
  filings: "Court filings & submissions"
};

export function defaultCategoryForEventAddKind(kind: EventAddKind): string {
  return kind === "filings" ? "Court Filing" : "Hearing";
}

export function eventCategoriesForAddKind(
  kind: EventAddKind,
  allCategories: readonly string[]
): string[] {
  const allowed =
    kind === "filings"
      ? (PLEADING_EVENT_CATEGORIES as readonly string[])
      : (APPEARANCE_EVENT_CATEGORIES as readonly string[]);
  return allCategories.filter((category) => allowed.includes(category));
}

export const APPEARANCE_EVENT_CATEGORIES = [
  "Hearing",
  "Consultation",
  "Meeting",
  "Internal Meeting",
  "Client Call",
  "Other"
] as const;

export const PLEADING_EVENT_CATEGORIES = ["Deadline", "Submission", "Court Filing"] as const;

export function isAppearanceCategory(category: string): boolean {
  return (APPEARANCE_EVENT_CATEGORIES as readonly string[]).includes(category);
}

export function isPleadingCategory(category: string): boolean {
  return (PLEADING_EVENT_CATEGORIES as readonly string[]).includes(category);
}

/** Filing events default to the case attorney; hearings and other appearances use the same rule. */
export function defaultEventResponsiblePerson(
  category: string,
  caseOption: Pick<CaseOption, "assignedAttorney"> | null | undefined,
  _roster: string[] = []
): string {
  void category;
  return caseOption?.assignedAttorney?.trim() || "";
}

/** When user picks Other, store as "Other — custom label" for the sheet. */
export function resolveEventCategory(category: string, categoryOther?: string): string {
  const cat = String(category || "Hearing").trim();
  if (cat !== "Other") return cat;
  const other = String(categoryOther || "").trim();
  return other ? `Other — ${other}` : "Other";
}

export function isOtherCategory(category: string): boolean {
  const cat = String(category || "").trim();
  return cat === "Other" || cat.startsWith("Other —");
}

export const HEARING_PREP_ITEMS = [
  "Confirm hearing date & time with court",
  "Prepare appearance slip / counsel ID",
  "Review pleadings & exhibits",
  "Brief client / confirm witnesses",
  "Subpoena / witness list ready",
  "Proof of filing / e-court access ready"
] as const;

export const HEARING_INCIDENT_OPTIONS = [
  "Arraignment",
  "Pre trial",
  "Arraignment and pre-trial",
  "Preliminary Conference",
  "Mediation",
  "JRD",
  "Trial Proper - Presentation of Evidence",
  "Promulgation",
  "Other"
] as const;

export const HEARING_PLATFORM_OPTIONS = ["Court", "Video conference", "Other"] as const;

export function resolveEventPlatform(platform: string, platformOther?: string): string {
  const value = String(platform || "").trim();
  if (!value) return "";
  if (value !== "Other") return value;
  const other = String(platformOther || "").trim();
  return other ? `Other — ${other}` : "Other";
}

export function splitEventPlatform(platform: string): { platform: string; platformOther: string } {
  const value = String(platform || "").trim();
  if (value.startsWith("Other — ")) {
    return { platform: "Other", platformOther: value.slice("Other — ".length).trim() };
  }
  if ((HEARING_PLATFORM_OPTIONS as readonly string[]).includes(value)) {
    return { platform: value, platformOther: "" };
  }
  if (value === "Other") return { platform: "Other", platformOther: "" };
  return { platform: value, platformOther: "" };
}

export function platformOptionsForEventCategory(
  category: string,
  allPlatforms: readonly string[]
): string[] {
  if (String(category || "").trim() === "Hearing") return [...HEARING_PLATFORM_OPTIONS];
  return [...allPlatforms];
}

export function resolveHearingIncident(incident: string, incidentOther?: string): string {
  const value = String(incident || "").trim();
  if (!value) return "";
  if (value !== "Other") return value;
  const other = String(incidentOther || "").trim();
  return other ? `Other — ${other}` : "Other";
}

export function mergeIncidentIntoSessionNotes(sessionNotes: string, incidentLabel: string): string {
  const notes = String(sessionNotes || "").trim();
  const incident = String(incidentLabel || "").trim();
  if (!incident) return notes;
  const block = `Incident: ${incident}`;
  if (notes.toLowerCase().startsWith("incident:")) return notes;
  return notes ? `${block}\n${notes}` : block;
}

/** Common session labels from a pre-trial order (PTO) schedule. */
export const PTO_SESSION_PRESETS = [
  "Pre-trial",
  "Presentation of evidence",
  "Rebuttal",
  "Sur-rebuttal",
  "Clarificatory hearing",
  "Promulgation",
  "Trial"
] as const;

export type SucceedingHearingDate = {
  eventDate: string;
  startTime?: string;
  sessionLabel: string;
};

export function defaultPtoScheduleRows(): SucceedingHearingDate[] {
  return [
    { eventDate: "", startTime: "", sessionLabel: "Presentation of evidence" },
    { eventDate: "", startTime: "", sessionLabel: "Rebuttal" }
  ];
}

export function parseSucceedingHearingDates(raw: unknown): SucceedingHearingDate[] {
  if (!Array.isArray(raw)) return [];
  const rows: SucceedingHearingDate[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const eventDate = String((row as SucceedingHearingDate).eventDate || "").trim();
    const sessionLabel = String((row as SucceedingHearingDate).sessionLabel || "").trim();
    if (!eventDate || !sessionLabel) continue;
    const startTime = String((row as SucceedingHearingDate).startTime || "").trim();
    rows.push({ eventDate, sessionLabel, startTime: startTime || undefined });
  }
  return rows;
}

export function validateSucceedingHearingDates(dates: SucceedingHearingDate[]): string | null {
  if (dates.length < 1) return "Add at least one hearing date from the pre-trial order.";
  return null;
}

export function splitEventCategory(category: string): { category: string; categoryOther: string } {
  const cat = String(category || "").trim();
  if (cat.startsWith("Other — ")) {
    return { category: "Other", categoryOther: cat.slice("Other — ".length).trim() };
  }
  return { category: cat || "Hearing", categoryOther: "" };
}

export function shouldOfferEventFollowUpTask(category: string): boolean {
  return isPleadingCategory(category);
}

export function shouldOfferEventReminderTask(category: string): boolean {
  return isPleadingCategory(category);
}

export const SCHEDULE_CONFIRMATION_CATEGORIES = [
  "Meeting",
  "Consultation",
  "Client Call",
  "Internal Meeting"
] as const;

export const SCHEDULE_CONFIRMATION_PLATFORMS = [
  "Zoom",
  "Google Meet",
  "Microsoft Teams",
  "Phone",
  "Court AVR"
] as const;

export function normalizeScheduleCategory(category: string): string {
  const split = splitEventCategory(category);
  if (split.category === "Other" && split.categoryOther) return split.categoryOther.trim();
  return split.category.trim();
}

export function isScheduleConfirmationCategory(category: string): boolean {
  const normalized = normalizeScheduleCategory(category || "");
  return (SCHEDULE_CONFIRMATION_CATEGORIES as readonly string[]).includes(normalized);
}

export function isScheduleConfirmationPlatform(platform: string): boolean {
  const value = platform.trim();
  return value ? (SCHEDULE_CONFIRMATION_PLATFORMS as readonly string[]).includes(value) : false;
}

/** Meetings, consultations, client calls, and internal meetings — any platform including in person. */
export function isScheduleConfirmationEvent(item: {
  source?: string;
  category?: string;
  platform?: string;
}): boolean {
  if (item.source !== "Event") return false;
  return isScheduleConfirmationCategory(item.category || "");
}

export type ScheduleConfirmationDraft = {
  clientCase: string;
  category: string;
  categoryOther?: string;
  platform: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  details?: string;
  responsible?: string;
};

export function buildScheduleConfirmationDraftItem(
  draft: ScheduleConfirmationDraft
): {
  source: "Event";
  category: string;
  platform: string;
  clientCase: string;
  eventDate: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string;
  details: string;
  assignedTo: string;
} {
  const category = resolveEventCategory(draft.category, draft.categoryOther);
  const eventDate = String(draft.eventDate || "").trim();
  return {
    source: "Event",
    category,
    platform: draft.platform.trim(),
    clientCase: draft.clientCase.trim(),
    eventDate: eventDate || null,
    date: eventDate,
    startTime: draft.startTime?.trim() || null,
    endTime: draft.endTime?.trim() || null,
    venue: String(draft.venue || "").trim(),
    details: String(draft.details || "").trim(),
    assignedTo: String(draft.responsible || "").trim()
  };
}

export function mergeHearingPrepIntoDetails(details: string, prepItems: string[]): string {
  const base = String(details || "").trim();
  const items = prepItems.map((item) => item.trim()).filter(Boolean);
  if (!items.length) return base;
  const block = `Hearing prep: ${items.join("; ")}`;
  if (base.toLowerCase().includes("hearing prep:")) return base;
  return base ? `${base}\n\n${block}` : block;
}

export function mergeFilingPrepIntoDetails(details: string, prepItems: string[]): string {
  const base = String(details || "").trim();
  const items = prepItems.map((item) => item.trim()).filter(Boolean);
  if (!items.length) return base;
  const block = `Filing prep: ${items.join("; ")}`;
  if (base.toLowerCase().includes("filing prep:")) return base;
  return base ? `${base}\n\n${block}` : block;
}

/** Parse selected hearing prep items from event details (semicolon-separated after "Hearing prep:"). */
export function parseHearingPrepItemsFromDetails(details: string): string[] {
  return parsePrepItemsFromDetailsBlock(details, "Hearing prep");
}

/** Parse selected filing prep items from event details (semicolon-separated after "Filing prep:"). */
export function parseFilingPrepItemsFromDetails(details: string): string[] {
  return parsePrepItemsFromDetailsBlock(details, "Filing prep");
}

function parsePrepItemsFromDetailsBlock(details: string, label: string): string[] {
  const text = String(details || "");
  const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  if (!match) return [];
  return match[1]
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isHearingEventCategory(category: string): boolean {
  return String(category || "").trim() === "Hearing";
}

export function isOpenHearingEvent(
  item: Pick<{ source: string; category: string; status: string; done: boolean }, "source" | "category" | "status" | "done">
): boolean {
  if (item.source !== "Event" || !isHearingEventCategory(item.category)) return false;
  return !item.done && item.status !== "Done" && item.status !== "Submitted" && item.status !== "Cancelled";
}

export function hearingPrepChecklistTitle(category: string): string {
  return isHearingEventCategory(category) ? "Hearing prep checklist" : "Filing prep checklist";
}

export function computeResponsiveFilingDate(receivedDate: string, periodDays: number): string {
  if (!receivedDate || !Number.isFinite(periodDays) || periodDays < 1) return "";
  return addDaysYmd(receivedDate, periodDays);
}

/** Normalize create/edit payload — computes responsive filing dates and validates by category. */
export function normalizeEventFormInput(raw: EventFormInput): EventFormInput {
  const category = resolveEventCategory(raw.category, raw.categoryOther);
  const pleadingType = String(raw.pleadingType || "").trim();
  const receivedDate = String(raw.receivedDate || "").trim();
  const periodToFileDays = Number(raw.periodToFileDays || 0);

  let filingDeadline = String(raw.filingDeadline || "").trim();
  let filingDate = String(raw.filingDate || "").trim();
  let eventDate = String(raw.eventDate || "").trim();

  if (isPleadingCategory(category)) {
    if (pleadingType === "Responsive pleading") {
      const received = receivedDate || todayYmd();
      filingDate = computeResponsiveFilingDate(received, periodToFileDays || 0);
      if (filingDate) filingDeadline = filingDate;
      return {
        ...raw,
        category,
        pleadingType,
        receivedDate: received,
        periodToFileDays: periodToFileDays || 0,
        filingDate,
        filingDeadline,
        eventDate: ""
      };
    }

    if (pleadingType === "Initiatory pleading") {
      filingDate = "";
      return {
        ...raw,
        category,
        pleadingType,
        receivedDate: "",
        periodToFileDays: 0,
        filingDate: "",
        filingDeadline,
        eventDate: ""
      };
    }

    return {
      ...raw,
      category,
      pleadingType,
      filingDate: filingDate || "",
      filingDeadline,
      eventDate: ""
    };
  }

  if (isAppearanceCategory(category)) {
    return {
      ...raw,
      category,
      pleadingType: "",
      pleadingCaseNature: "",
      receivedDate: "",
      periodToFileDays: 0,
      filingDate: "",
      filingDeadline: "",
      eventDate
    };
  }

  return { ...raw, category };
}

/** Build event payload from the add/edit form before client file creation runs. */
export function buildEventFormInputFromFormData(fd: FormData): EventFormInput {
  let sessionNotes = String(fd.get("sessionNotes") || "").trim();
  const incidentLabel = resolveHearingIncident(
    String(fd.get("hearingIncident") || ""),
    String(fd.get("hearingIncidentOther") || "")
  );
  sessionNotes = mergeIncidentIntoSessionNotes(sessionNotes, incidentLabel);

  let details = String(fd.get("details") || "").trim();
  if (sessionNotes) {
    details = details ? `${details}\n\nSession: ${sessionNotes}` : `Session: ${sessionNotes}`;
  }

  const rawCategory = String(fd.get("category") || "Hearing");
  const hearingPrep = fd.getAll("hearingPrep").map((value) => String(value).trim()).filter(Boolean);
  const filingPrep = fd.getAll("filingPrep").map((value) => String(value).trim()).filter(Boolean);
  const fromPretrialOrder = fd.get("fromPretrialOrder") === "1";
  let succeedingHearingDates: SucceedingHearingDate[] = [];
  try {
    succeedingHearingDates = parseSucceedingHearingDates(
      JSON.parse(String(fd.get("succeedingHearingDates") || "[]"))
    );
  } catch {
    succeedingHearingDates = [];
  }

  return normalizeEventFormInput({
    clientCase: String(fd.get("clientCase") || "").trim(),
    eventDate: String(fd.get("eventDate") || ""),
    filingDeadline: String(fd.get("filingDeadline") || ""),
    startTime: String(fd.get("startTime") || ""),
    endTime: String(fd.get("endTime") || ""),
    category: rawCategory,
    categoryOther: String(fd.get("categoryOther") || ""),
    priority: String(fd.get("priority") || "Medium"),
    responsible: String(fd.get("responsible") || ""),
    venue: String(fd.get("venue") || ""),
    platform: resolveEventPlatform(String(fd.get("platform") || ""), String(fd.get("platformOther") || "")),
    filingMode: String(fd.get("filingMode") || ""),
    pleadingType: String(fd.get("pleadingType") || ""),
    pleadingCaseNature: String(fd.get("pleadingCaseNature") || ""),
    receivedDate: String(fd.get("receivedDate") || ""),
    periodToFileDays: Number(fd.get("periodToFileDays") || 0),
    filingDate: String(fd.get("filingDate") || ""),
    details: mergeFilingPrepIntoDetails(mergeHearingPrepIntoDetails(details, hearingPrep), filingPrep),
    previousAction: String(fd.get("previousAction") || ""),
    nextAction: String(fd.get("nextAction") || ""),
    remarks: String(fd.get("remarks") || ""),
    status: String(fd.get("status") || "Scheduled"),
    reminderDays: Number(fd.get("reminderDays") || 1),
    calendarSync: fd.get("calendarSync") === "on",
    createFollowUpTask: fd.get("createFollowUpTask") === "on",
    createReminderTask: fd.get("createReminderTask") === "on",
    reminderTaskDaysBefore: Number(fd.get("reminderTaskDaysBefore") || 3),
    prepAssignedTo: String(fd.get("prepAssignedTo") || "").trim(),
    fromPretrialOrder,
    ptoOrderDate: String(fd.get("ptoOrderDate") || ""),
    succeedingHearingDates,
    billAppearanceFee: fd.get("billAppearanceFee") === "on",
    billPleadingFee: fd.get("billPleadingFee") === "on",
    billingFeeAmount: String(fd.get("billingFeeAmount") || "").trim()
  });
}

export function validateEventFormInput(
  form: EventFormInput,
  options?: { requireClientCase?: boolean }
): string | null {
  if (options?.requireClientCase !== false && !form.clientCase?.trim()) {
    return "Select or enter a client / case before saving.";
  }
  if (!form.responsible?.trim()) return "Responsible person is required.";
  if (!form.details?.trim()) return "Agenda / details are required.";

  const category = String(form.category || "").trim();
  if (category === "Other" && !String(form.categoryOther || "").trim()) {
    return "Specify what kind of event this is when Other is selected.";
  }

  const normalizedCategory = resolveEventCategory(form.category, form.categoryOther);
  if (isAppearanceCategory(normalizedCategory)) {
    if (form.fromPretrialOrder && form.succeedingHearingDates?.length) {
      return validateSucceedingHearingDates(form.succeedingHearingDates);
    }
    if (!form.eventDate?.trim()) return "Enter the hearing / appearance date.";
    if (isHearingEventCategory(normalizedCategory) && String(form.platform || "").trim() === "Other") {
      return "Specify the platform when Other is selected.";
    }
    return null;
  }

  if (isPleadingCategory(normalizedCategory)) {
    if (!form.filingMode?.trim()) return "Select a filing mode.";
    if (!form.pleadingType?.trim()) return "Select a pleading type.";
    if (!form.pleadingCaseNature?.trim()) return "Select civil/administrative or criminal.";
    if (form.pleadingType === "Responsive pleading") {
      if (!form.receivedDate?.trim()) return "Enter the date the pleading was received.";
      if (!form.periodToFileDays || form.periodToFileDays < 1) {
        return "Enter the period to file (number of days).";
      }
      if (form.createReminderTask && !form.prepAssignedTo?.trim()) {
        return "Select who will prepare the filing (Andrea, Jas, or both).";
      }
      return null;
    }
    if (!form.filingDeadline?.trim()) return "Enter the due / filing deadline.";
    if (form.createReminderTask && !form.prepAssignedTo?.trim()) {
      return "Select who will prepare the filing (Andrea, Jas, or both).";
    }
    return null;
  }

  if (!form.eventDate?.trim() && !form.filingDeadline?.trim()) {
    return "Enter an event date or a filing deadline.";
  }
  return null;
}
