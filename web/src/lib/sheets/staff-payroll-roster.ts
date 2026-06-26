import {
  findStaffSalaryProfileInRoster,
  parseStaffPayrollRoster,
  serializeStaffPayrollRoster,
  STAFF_PAYROLL_ROSTER_SETTING_KEY,
  type StaffPayrollRosterEntry
} from "@/lib/staff-payroll-roster";
import type { StaffSalaryProfile } from "@/lib/staff-salary";
import { appendSheetValues, updateSheetValues } from "@/lib/sheets/client";
import { invalidateSettingsCache, readSettingsMap, readSettingsRowIndex } from "@/lib/sheets/settings";
import { GL } from "@/lib/gl-config";

async function upsertSettingValue(
  accessToken: string,
  key: string,
  value: string,
  rowIndex: Map<string, number>
): Promise<void> {
  const row = rowIndex.get(key);
  if (row !== undefined) {
    await updateSheetValues(accessToken, `'${GL.sheets.settings}'!B${row}`, [[value]]);
    return;
  }
  await appendSheetValues(accessToken, `'${GL.sheets.settings}'!A:B`, [[key, value]]);
  rowIndex.set(key, rowIndex.size + 2);
}

export async function getStaffPayrollRoster(accessToken: string): Promise<StaffPayrollRosterEntry[]> {
  const settings = await readSettingsMap(accessToken);
  return parseStaffPayrollRoster(settings.get(STAFF_PAYROLL_ROSTER_SETTING_KEY));
}

export async function saveStaffPayrollRoster(
  accessToken: string,
  roster: StaffPayrollRosterEntry[]
): Promise<StaffPayrollRosterEntry[]> {
  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(
    accessToken,
    STAFF_PAYROLL_ROSTER_SETTING_KEY,
    serializeStaffPayrollRoster(roster),
    rowIndex
  );
  invalidateSettingsCache(accessToken);
  return getStaffPayrollRoster(accessToken);
}

export async function resolveStaffSalaryProfile(
  accessToken: string,
  staffId: string
): Promise<StaffSalaryProfile | undefined> {
  const roster = await getStaffPayrollRoster(accessToken);
  return findStaffSalaryProfileInRoster(roster, staffId);
}
