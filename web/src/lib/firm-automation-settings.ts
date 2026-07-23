/**
 * Firm automation toggles — sheet-backed, with env override escape hatch.
 *
 * Resolution order (highest wins):
 * 1. Settings-tab values for the current workbook
 * 2. Vercel FIRM_* env overrides (ops escape hatch)
 * 3. Conservative code defaults
 */

import "server-only";

import { readSettingsMap, upsertSettings } from "@/lib/sheets/settings";
import {
  DEFAULT_FIRM_AUTOMATION_SETTINGS,
  FIRM_AUTOMATION_ENV_KEYS,
  FIRM_AUTOMATION_SETTING_KEYS,
  normalizeFirmAutomationPatch,
  parseBoolText,
  parsePositiveIntText,
  type FirmAutomationSettings,
  type FirmAutomationSettingsPatch
} from "@/lib/firm-automation-settings-shared";

export {
  DEFAULT_FIRM_AUTOMATION_SETTINGS,
  FIRM_AUTOMATION_ENV_KEYS,
  FIRM_AUTOMATION_SETTING_KEYS,
  normalizeFirmAutomationPatch,
  type FirmAutomationSettings,
  type FirmAutomationSettingsPatch
};

function parseEnvBool(name: string, defaultValue: boolean): boolean {
  return parseBoolText(process.env[name], defaultValue);
}

function parseEnvPositiveInt(name: string, defaultValue: number): number {
  return parsePositiveIntText(process.env[name], defaultValue);
}

/** Resolve from code defaults + optional env overrides (no sheet). */
export function getFirmAutomationSettings(): FirmAutomationSettings {
  const defaults = { ...DEFAULT_FIRM_AUTOMATION_SETTINGS };
  return {
    autoPostAppearanceOnCourtConfirm: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.autoPostAppearanceOnCourtConfirm,
      defaults.autoPostAppearanceOnCourtConfirm
    ),
    proactiveClientEventNotices: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.proactiveClientEventNotices,
      defaults.proactiveClientEventNotices
    ),
    prepNudgeDaysBeforeHearing: parseEnvPositiveInt(
      FIRM_AUTOMATION_ENV_KEYS.prepNudgeDaysBeforeHearing,
      defaults.prepNudgeDaysBeforeHearing
    ),
    waitingClientEscalateDays: parseEnvPositiveInt(
      FIRM_AUTOMATION_ENV_KEYS.waitingClientEscalateDays,
      defaults.waitingClientEscalateDays
    ),
    createCourtConfirmationTask: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.createCourtConfirmationTask,
      defaults.createCourtConfirmationTask
    ),
    createPostHearingFollowUpTask: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.createPostHearingFollowUpTask,
      defaults.createPostHearingFollowUpTask
    ),
    createFilingPrepReminderTask: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.createFilingPrepReminderTask,
      defaults.createFilingPrepReminderTask
    ),
    createIntakeSeedTasks: parseEnvBool(
      FIRM_AUTOMATION_ENV_KEYS.createIntakeSeedTasks,
      defaults.createIntakeSeedTasks
    )
  };
}

function mergeSheetOverrides(
  base: FirmAutomationSettings,
  settings: Map<string, string>
): FirmAutomationSettings {
  return {
    autoPostAppearanceOnCourtConfirm: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.autoPostAppearanceOnCourtConfirm),
      base.autoPostAppearanceOnCourtConfirm
    ),
    proactiveClientEventNotices: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.proactiveClientEventNotices),
      base.proactiveClientEventNotices
    ),
    prepNudgeDaysBeforeHearing: parsePositiveIntText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.prepNudgeDaysBeforeHearing),
      base.prepNudgeDaysBeforeHearing
    ),
    waitingClientEscalateDays: parsePositiveIntText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.waitingClientEscalateDays),
      base.waitingClientEscalateDays
    ),
    createCourtConfirmationTask: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.createCourtConfirmationTask),
      base.createCourtConfirmationTask
    ),
    createPostHearingFollowUpTask: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.createPostHearingFollowUpTask),
      base.createPostHearingFollowUpTask
    ),
    createFilingPrepReminderTask: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.createFilingPrepReminderTask),
      base.createFilingPrepReminderTask
    ),
    createIntakeSeedTasks: parseBoolText(
      settings.get(FIRM_AUTOMATION_SETTING_KEYS.createIntakeSeedTasks),
      base.createIntakeSeedTasks
    )
  };
}

/** Resolve automation settings for the current workbook (sheet > env > defaults). */
export async function readFirmAutomationSettings(accessToken?: string): Promise<FirmAutomationSettings> {
  const envMerged = getFirmAutomationSettings();
  if (!accessToken) return envMerged;
  try {
    const sheet = await readSettingsMap(accessToken);
    return mergeSheetOverrides(envMerged, sheet);
  } catch {
    return envMerged;
  }
}

export async function writeFirmAutomationSettings(
  accessToken: string,
  patch: FirmAutomationSettingsPatch
): Promise<FirmAutomationSettings> {
  const normalized = normalizeFirmAutomationPatch(patch);
  const entries: Array<[string, string]> = [];
  for (const key of Object.keys(normalized) as Array<keyof FirmAutomationSettings>) {
    const value = normalized[key];
    if (value === undefined) continue;
    entries.push([FIRM_AUTOMATION_SETTING_KEYS[key], String(value)]);
  }
  if (entries.length) {
    await upsertSettings(accessToken, entries);
  }
  return readFirmAutomationSettings(accessToken);
}
