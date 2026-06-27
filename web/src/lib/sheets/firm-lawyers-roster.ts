import {
  activeFirmLawyersRoster,
  ensureManagingPartnerOnRoster,
  parseFirmLawyersRoster,
  serializeFirmLawyersRoster,
  FIRM_LAWYERS_ROSTER_SETTING_KEY,
  type FirmLawyerRosterEntry
} from "@/lib/firm-lawyers-roster";
import { GL } from "@/lib/gl-config";
import { appendSheetValues, updateSheetValues, toA1Range } from "@/lib/sheets/client";
import { invalidateSettingsCache, readSettingsMap, readSettingsRowIndex } from "@/lib/sheets/settings";
import { getSheetsClient, getSpreadsheetId as getTasksSpreadsheetId } from "@/lib/office-tasks/sheets/client";
import { SHEETS } from "@/lib/tasks-config";

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

export async function getFirmLawyersRoster(accessToken: string): Promise<FirmLawyerRosterEntry[]> {
  const settings = await readSettingsMap(accessToken);
  const roster = parseFirmLawyersRoster(settings.get(FIRM_LAWYERS_ROSTER_SETTING_KEY));
  return ensureManagingPartnerOnRoster(roster);
}

async function readTasksEmployeeRows(accessToken: string): Promise<string[][]> {
  const sheets = getSheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getTasksSpreadsheetId(),
    range: toA1Range(SHEETS.employees, "A2:D500"),
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  return (response.data.values as string[][]) || [];
}

async function writeTasksEmployeeRows(accessToken: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getTasksSpreadsheetId();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: toA1Range(SHEETS.employees, "A2:D500")
  });
  if (!rows.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: toA1Range(SHEETS.employees, `A2:D${rows.length + 1}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });
}

/** Keep non-lawyer employees; replace lawyer rows with roster lawyers who oversee tasks. */
export async function syncFirmLawyersToEmployeesSheet(
  accessToken: string,
  roster: FirmLawyerRosterEntry[]
): Promise<void> {
  const lawyers = activeFirmLawyersRoster(roster).filter((entry) => entry.overseesTasks);
  const existing = await readTasksEmployeeRows(accessToken);

  const lawyerNames = new Set(lawyers.map((l) => l.displayName.trim().toLowerCase()));
  const preserved = existing.filter((row) => {
    const name = String(row[0] ?? "").trim();
    const role = String(row[2] ?? "").trim().toLowerCase();
    if (!name) return false;
    if (lawyerNames.has(name.toLowerCase())) return false;
    if (role.includes("lawyer") || role.includes("attorney") || /^atty/i.test(name)) return false;
    return true;
  });

  const lawyerRows = lawyers.map((lawyer) => [
    lawyer.displayName,
    lawyer.email,
    /managing partner/i.test(lawyer.designation || "") ? "Managing Partner" : "Lawyer",
    "TRUE"
  ]);

  await writeTasksEmployeeRows(accessToken, [...preserved, ...lawyerRows]);
}

export async function saveFirmLawyersRoster(
  accessToken: string,
  roster: FirmLawyerRosterEntry[]
): Promise<FirmLawyerRosterEntry[]> {
  const normalized = ensureManagingPartnerOnRoster(roster);
  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(
    accessToken,
    FIRM_LAWYERS_ROSTER_SETTING_KEY,
    serializeFirmLawyersRoster(normalized),
    rowIndex
  );
  invalidateSettingsCache(accessToken);
  const saved = ensureManagingPartnerOnRoster(await parseFirmLawyersRosterFromSettings(accessToken));
  await syncFirmLawyersToEmployeesSheet(accessToken, saved);
  return saved;
}

async function parseFirmLawyersRosterFromSettings(accessToken: string): Promise<FirmLawyerRosterEntry[]> {
  const settings = await readSettingsMap(accessToken);
  return parseFirmLawyersRoster(settings.get(FIRM_LAWYERS_ROSTER_SETTING_KEY));
}
