import { google } from "googleapis";
import { GL } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!id) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured.");
  }
  return id;
}

export function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

/** A1 notation for API calls — required when sheet titles contain spaces. */
export function toA1Range(sheetTitle: string, a1: string): string {
  const escaped = String(sheetTitle || "").replace(/'/g, "''");
  const cell = String(a1 || "A1").replace(/^'|'+$/g, "");
  return `'${escaped}'!${cell}`;
}

function wrapSheetsApiError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  if (/protected cell|protected range|protected sheet/i.test(message)) {
    return new Error(
      "Google Sheets blocked this save because that tab or cell is protected. Open your billing spreadsheet → Data → Protect sheets and ranges → edit or remove protection on the Settings tab (columns A–B) and Field Dispatch if needed, or add your billing login Google account as someone who can edit protected ranges. Staff salary, overtime/adjustments, and firm finances all save to Settings."
    );
  }

  if (/unable to parse range/i.test(message)) {
    const match = message.match(/Unable to parse range:\s*(.+)$/i);
    const bad = match?.[1]?.trim() || "a sheet name with spaces";

    if (/audit\s*log/i.test(bad)) {
      return new Error(
        "Could not write to the Audit Log sheet. Redeploy the latest app (it creates this tab automatically), or add a sheet tab named exactly Audit Log in your spreadsheet, then try again."
      );
    }

    return new Error(
      `Spreadsheet formula problem (${bad}). Sheet names with spaces must be quoted in formulas — use ='Trust Log'!D1 instead of =Trust Log!D1. Check the client tab (E1–E3) and Master List total-due column for this client.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function getSheetValues(
  accessToken: string,
  range: string
): Promise<string[][]> {
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
    if (isQuotaError(error)) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: getSpreadsheetId(),
          range,
          valueRenderOption: "UNFORMATTED_VALUE",
          dateTimeRenderOption: "FORMATTED_STRING"
        });
        return (response.data.values as string[][]) || [];
      } catch (retryError) {
        if (isQuotaError(retryError)) {
          throw new Error(quotaErrorMessage());
        }
        throw wrapSheetsApiError(retryError);
      }
    }
    throw wrapSheetsApiError(error);
  }
}

export async function appendSheetValues(
  accessToken: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values }
    });
  } catch (error) {
    throw wrapSheetsApiError(error);
  }
}

export async function updateSheetValues(
  accessToken: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values }
    });
  } catch (error) {
    throw wrapSheetsApiError(error);
  }
}

/** Always hits the API — never uses the 5‑minute sheet-titles cache (stale cache broke billing after new clients). */
export async function sheetExists(accessToken: string, title: string): Promise<boolean> {
  const { getSheetIdByTitle } = await import("@/lib/sheets/sheet-meta");
  const id = await getSheetIdByTitle(accessToken, title);
  return id !== null;
}

export { GL };
