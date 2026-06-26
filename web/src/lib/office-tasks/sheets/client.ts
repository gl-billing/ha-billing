import { google } from "googleapis";
import { SHEETS } from "@/lib/tasks-config";

export function getSpreadsheetId(): string {
  const id =
    process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!id) {
    throw new Error("TASKS_GOOGLE_SPREADSHEET_ID (or GOOGLE_SPREADSHEET_ID) is not configured.");
  }
  return id;
}

export function isUsingBillingSpreadsheetFallback(): boolean {
  return !process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim();
}

export async function listSheetTitles(accessToken: string): Promise<string[]> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties.title"
  });
  return (
    meta.data.sheets
      ?.map((s) => s.properties?.title?.trim() || "")
      .filter((t) => t.length > 0) || []
  );
}

/** Fail fast with setup instructions instead of opaque "Unable to parse range". */
export async function assertTasksWorkbookSheets(accessToken: string): Promise<void> {
  const required = [SHEETS.tasks, SHEETS.events, SHEETS.employees] as const;
  const titles = await listSheetTitles(accessToken);
  const missing = required.filter((name) => !titles.includes(name));
  if (!missing.length) return;

  const id = getSpreadsheetId();
  const hint = isUsingBillingSpreadsheetFallback()
    ? "TASKS_GOOGLE_SPREADSHEET_ID is not set in web/.env.local, so the app is using your billing spreadsheet (GOOGLE_SPREADSHEET_ID). Add TASKS_GOOGLE_SPREADSHEET_ID with the ID of your Office Tasks workbook, then restart npm run dev:clean."
    : "Open your Office Tasks spreadsheet → Apps Script menu Task System → Setup / Repair Workbook (creates Master Tasks, Hearings & Events, Employees).";

  const tabs =
    titles.length > 0
      ? `Tabs found in this file: ${titles.slice(0, 12).join(", ")}${titles.length > 12 ? "…" : ""}.`
      : "No sheet tabs were found in this spreadsheet.";

  throw new Error(
    `Missing sheet tab(s): ${missing.join(", ")}. ${hint} ${tabs} (Spreadsheet ID: ${id.slice(0, 12)}…)`
  );
}

function wrapTasksSheetsError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  if (!/unable to parse range/i.test(message)) {
    return error instanceof Error ? error : new Error(message);
  }

  const match = message.match(/Unable to parse range:\s*(.+)$/i);
  const bad = match?.[1]?.trim() || "unknown range";

  if (/master tasks|hearings|employees/i.test(bad)) {
    const hint = isUsingBillingSpreadsheetFallback()
      ? "Set TASKS_GOOGLE_SPREADSHEET_ID in web/.env.local to your Office Tasks spreadsheet (not billing)."
      : "Run Task System → Setup / Repair Workbook on the tasks spreadsheet.";
    return new Error(
      `Could not read tasks data (${bad}). The tab may be missing or the wrong spreadsheet is linked. ${hint}`
    );
  }

  return new Error(`Could not read spreadsheet range (${bad}).`);
}

export function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

export function toA1Range(sheetTitle: string, a1: string): string {
  const escaped = String(sheetTitle || "").replace(/'/g, "''");
  const cell = String(a1 || "A1").replace(/^'|'+$/g, "");
  return `'${escaped}'!${cell}`;
}

export async function getSheetValues(accessToken: string, range: string): Promise<string[][]> {
  const sheets = getSheetsClient(accessToken);
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    return (response.data.values as string[][]) || [];
  } catch (error) {
    throw wrapTasksSheetsError(error);
  }
}

/** One round-trip for multiple ranges (faster home load). */
export async function batchGetSheetValues(accessToken: string, ranges: string[]): Promise<string[][][]> {
  return batchGetSheetValuesWithRender(accessToken, ranges, "UNFORMATTED_VALUE");
}

/** Formatted read — fallback when locale-formatted dates fail UNFORMATTED parsing. */
export async function batchGetSheetValuesFormatted(
  accessToken: string,
  ranges: string[]
): Promise<string[][][]> {
  return batchGetSheetValuesWithRender(accessToken, ranges, "FORMATTED_VALUE");
}

async function batchGetSheetValuesWithRender(
  accessToken: string,
  ranges: string[],
  valueRenderOption: "UNFORMATTED_VALUE" | "FORMATTED_VALUE"
): Promise<string[][][]> {
  if (!ranges.length) return [];
  const sheets = getSheetsClient(accessToken);
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: getSpreadsheetId(),
      ranges,
      valueRenderOption,
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    const valueRanges = response.data.valueRanges || [];
    return valueRanges.map((vr) => (vr.values as string[][]) || []);
  } catch (error) {
    throw wrapTasksSheetsError(error);
  }
}

export type AppendSheetResult = {
  updatedRange?: string | null;
  updatedRows?: number | null;
  sheetRow?: number;
};

/**
 * Last row in the first contiguous block of column A IDs (header is row 1).
 * Stops at the first blank gap so stray rows at 1000+ do not push new saves past the real list.
 */
export async function lastRowInPrimaryColumnABlock(
  accessToken: string,
  sheetName: string
): Promise<number> {
  const colA = await getSheetValues(accessToken, toA1Range(sheetName, "A2:A"));
  let lastRow = 1;
  let started = false;
  for (let index = 0; index < colA.length; index++) {
    const value = String(colA[index]?.[0] || "").trim();
    if (value) {
      started = true;
      lastRow = index + 2;
      continue;
    }
    if (started) break;
  }
  return lastRow;
}

/**
 * Write the next data row starting at column A.
 * Sheets API append() follows existing tables — misplaced legacy rows (column E / row 1000+)
 * cause new IDs to land in the wrong column and duplicate ID sequences.
 */
export async function appendRowAtColumnA(
  accessToken: string,
  sheetName: string,
  endColumn: string,
  row: unknown[]
): Promise<AppendSheetResult> {
  const sheetRow = (await lastRowInPrimaryColumnABlock(accessToken, sheetName)) + 1;
  const targetRange = toA1Range(sheetName, `A${sheetRow}:${endColumn}${sheetRow}`);
  await updateSheetValues(accessToken, targetRange, [row]);
  return { updatedRange: targetRange, updatedRows: 1, sheetRow };
}

export async function appendSheetValues(
  accessToken: string,
  range: string,
  values: unknown[][]
): Promise<AppendSheetResult> {
  const sheets = getSheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values }
  });
  return {
    updatedRange: response.data.updates?.updatedRange ?? null,
    updatedRows: response.data.updates?.updatedRows ?? null
  };
}

export async function updateSheetValues(
  accessToken: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

/** One round-trip for multiple cell ranges (status updates stay in sync). */
export async function batchUpdateSheetValues(
  accessToken: string,
  updates: Array<{ range: string; values: unknown[][] }>
): Promise<void> {
  if (!updates.length) return;
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map(({ range, values }) => ({ range, values }))
    }
  });
}
