/**
 * Client-safe firm automation types, defaults, and pure helpers.
 * Sheet I/O lives in firm-automation-settings.ts (server-only).
 */

export type FirmAutomationSettings = {
  autoPostAppearanceOnCourtConfirm: boolean;
  proactiveClientEventNotices: boolean;
  prepNudgeDaysBeforeHearing: number;
  waitingClientEscalateDays: number;
  createCourtConfirmationTask: boolean;
  createPostHearingFollowUpTask: boolean;
  createFilingPrepReminderTask: boolean;
  createIntakeSeedTasks: boolean;
};

/** Conservative defaults when no sheet/env values exist. */
export const DEFAULT_FIRM_AUTOMATION_SETTINGS: FirmAutomationSettings = {
  autoPostAppearanceOnCourtConfirm: true,
  proactiveClientEventNotices: true,
  prepNudgeDaysBeforeHearing: 3,
  waitingClientEscalateDays: 14,
  createCourtConfirmationTask: false,
  createPostHearingFollowUpTask: false,
  createFilingPrepReminderTask: false,
  createIntakeSeedTasks: false
};

/** Settings-tab keys (per workbook). */
export const FIRM_AUTOMATION_SETTING_KEYS: Record<keyof FirmAutomationSettings, string> = {
  autoPostAppearanceOnCourtConfirm: "Automation Auto Post Appearance On Court Confirm",
  proactiveClientEventNotices: "Automation Proactive Client Event Notices",
  prepNudgeDaysBeforeHearing: "Automation Prep Nudge Days Before Hearing",
  waitingClientEscalateDays: "Automation Waiting Client Escalate Days",
  createCourtConfirmationTask: "Automation Create Court Confirmation Task",
  createPostHearingFollowUpTask: "Automation Create Post Hearing Follow Up Task",
  createFilingPrepReminderTask: "Automation Create Filing Prep Reminder Task",
  createIntakeSeedTasks: "Automation Create Intake Seed Tasks"
};

/** Vercel env var names that override each setting (ops escape hatch). */
export const FIRM_AUTOMATION_ENV_KEYS: Record<keyof FirmAutomationSettings, string> = {
  autoPostAppearanceOnCourtConfirm: "FIRM_AUTO_POST_APPEARANCE_ON_COURT_CONFIRM",
  proactiveClientEventNotices: "FIRM_PROACTIVE_CLIENT_EVENT_NOTICES",
  prepNudgeDaysBeforeHearing: "FIRM_PREP_NUDGE_DAYS_BEFORE_HEARING",
  waitingClientEscalateDays: "FIRM_WAITING_CLIENT_ESCALATE_DAYS",
  createCourtConfirmationTask: "FIRM_CREATE_COURT_CONFIRMATION_TASK",
  createPostHearingFollowUpTask: "FIRM_CREATE_POST_HEARING_FOLLOW_UP_TASK",
  createFilingPrepReminderTask: "FIRM_CREATE_FILING_PREP_REMINDER_TASK",
  createIntakeSeedTasks: "FIRM_CREATE_INTAKE_SEED_TASKS"
};

export type FirmAutomationSettingsPatch = Partial<FirmAutomationSettings>;

export function normalizeFirmAutomationPatch(
  input: FirmAutomationSettingsPatch
): FirmAutomationSettingsPatch {
  const out: FirmAutomationSettingsPatch = {};
  if (typeof input.autoPostAppearanceOnCourtConfirm === "boolean") {
    out.autoPostAppearanceOnCourtConfirm = input.autoPostAppearanceOnCourtConfirm;
  }
  if (typeof input.proactiveClientEventNotices === "boolean") {
    out.proactiveClientEventNotices = input.proactiveClientEventNotices;
  }
  if (typeof input.createCourtConfirmationTask === "boolean") {
    out.createCourtConfirmationTask = input.createCourtConfirmationTask;
  }
  if (typeof input.createPostHearingFollowUpTask === "boolean") {
    out.createPostHearingFollowUpTask = input.createPostHearingFollowUpTask;
  }
  if (typeof input.createFilingPrepReminderTask === "boolean") {
    out.createFilingPrepReminderTask = input.createFilingPrepReminderTask;
  }
  if (typeof input.createIntakeSeedTasks === "boolean") {
    out.createIntakeSeedTasks = input.createIntakeSeedTasks;
  }
  if (typeof input.prepNudgeDaysBeforeHearing === "number") {
    const days = Math.round(input.prepNudgeDaysBeforeHearing);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      throw new Error("Prep nudge days must be between 1 and 30.");
    }
    out.prepNudgeDaysBeforeHearing = days;
  }
  if (typeof input.waitingClientEscalateDays === "number") {
    const days = Math.round(input.waitingClientEscalateDays);
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      throw new Error("Waiting-client escalate days must be between 1 and 90.");
    }
    out.waitingClientEscalateDays = days;
  }
  return out;
}

export function parseBoolText(raw: string | undefined, defaultValue: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  return defaultValue;
}

export function parsePositiveIntText(raw: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
