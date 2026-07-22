import { GL } from "@/lib/gl-config";
import { appendSheetValues, updateSheetValues } from "@/lib/sheets/client";
import { invalidateSettingsCache, readSettingsMap, readSettingsRowIndex } from "@/lib/sheets/settings";
import {
  DEFAULT_FIRM_ALERT_RULES,
  mergeFirmAlertRules,
  type FirmAlertRules
} from "@/lib/firm-alert-rules";

const SETTINGS_KEY = "Firm Alert Rules";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

/** Server-side rules — env overrides with safe defaults. */
export function getFirmAlertRules(): FirmAlertRules {
  return {
    followUpHorizonDays: parsePositiveInt(process.env.FIRM_FOLLOW_UP_HORIZON_DAYS, DEFAULT_FIRM_ALERT_RULES.followUpHorizonDays),
    filingAlertHorizonDays: parsePositiveInt(
      process.env.FIRM_FILING_ALERT_HORIZON_DAYS,
      DEFAULT_FIRM_ALERT_RULES.filingAlertHorizonDays
    ),
    balanceAlertMin: parsePositiveInt(process.env.FIRM_BALANCE_ALERT_MIN, DEFAULT_FIRM_ALERT_RULES.balanceAlertMin),
    overdueBalanceMin: parsePositiveInt(process.env.FIRM_OVERDUE_BALANCE_MIN, DEFAULT_FIRM_ALERT_RULES.overdueBalanceMin)
  };
}

/** Partner overrides from Settings sheet, merged with env defaults. */
export async function readFirmAlertRulesFromSettings(accessToken: string): Promise<FirmAlertRules> {
  const settings = await readSettingsMap(accessToken);
  const raw = settings.get(SETTINGS_KEY);
  if (!raw) return getFirmAlertRules();
  try {
    return mergeFirmAlertRules(JSON.parse(raw) as Partial<FirmAlertRules>, getFirmAlertRules());
  } catch {
    return getFirmAlertRules();
  }
}

export async function saveFirmAlertRulesToSettings(
  accessToken: string,
  partial: Partial<FirmAlertRules>
): Promise<FirmAlertRules> {
  const rules = mergeFirmAlertRules(partial, getFirmAlertRules());
  const rowIndex = await readSettingsRowIndex(accessToken);
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(SETTINGS_KEY);
  const value = JSON.stringify(rules);
  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[value]]);
  } else {
    await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[SETTINGS_KEY, value]]);
  }
  invalidateSettingsCache(accessToken);
  return rules;
}
