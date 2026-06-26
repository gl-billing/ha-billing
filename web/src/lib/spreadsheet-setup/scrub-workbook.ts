import { google } from "googleapis";
import { GL } from "@/lib/gl-config";
import { SHEETS as TASK_SHEETS } from "@/lib/tasks-config";

type SheetRef = { title: string; sheetId: number };

function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function quoteSheetTitle(title: string): string {
  return `'${String(title).replace(/'/g, "''")}'`;
}

async function listWorkbookSheets(accessToken: string, spreadsheetId: string): Promise<SheetRef[]> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)"
  });

  return (
    meta.data.sheets
      ?.map((sheet) => {
        const title = sheet.properties?.title?.trim() || "";
        const sheetId = sheet.properties?.sheetId;
        if (!title || sheetId === undefined || sheetId === null) return null;
        return { title, sheetId };
      })
      .filter((sheet): sheet is SheetRef => sheet !== null) ?? []
  );
}

function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: string }).message || error);
  }
  return String(error);
}

/** Drop sheet/range protection so scrub can clear rows and delete client tabs. */
export async function removeWorkbookProtection(
  accessToken: string,
  spreadsheetId: string
): Promise<number> {
  const sheets = getSheetsClient(accessToken);
  let ids: number[] = [];
  try {
    // Some GL workbooks return 400 when protectedRanges is in the fields mask — fetch full metadata instead.
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    ids =
      meta.data.protectedRanges
        ?.map((range) => range.protectedRangeId)
        .filter((id): id is number => typeof id === "number" && id >= 0) ?? [];
  } catch {
    return 0;
  }

  if (!ids.length) return 0;

  let removed = 0;
  for (const protectedRangeId of ids) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteProtectedRange: { protectedRangeId } }]
        }
      });
      removed += 1;
    } catch {
      // Owner-only protection on GL copies — skip and try clearing anyway.
    }
  }

  return removed;
}

async function clearDataRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetTitle(sheetTitle)}!A2:ZZZ`
  });
}

async function deleteSheetsById(
  accessToken: string,
  spreadsheetId: string,
  sheetIds: number[]
): Promise<{ deleted: number; failed: number }> {
  if (!sheetIds.length) return { deleted: 0, failed: 0 };
  const sheets = getSheetsClient(accessToken);
  let deleted = 0;
  let failed = 0;

  for (const sheetId of sheetIds) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId } }]
        }
      });
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed };
}

/** System tabs kept when scrubbing a copied billing workbook — structure + automation only. */
export const BILLING_SYSTEM_TABS = new Set(
  [
    GL.sheets.settings,
    GL.sheets.master,
    GL.sheets.walkIn,
    GL.sheets.spotBilling,
    GL.sheets.notarization,
    GL.sheets.fieldDispatch,
    GL.sheets.dashboard,
    GL.sheets.documentLog,
    GL.sheets.auditLog,
    "Template",
    "Invoice",
    "Acknowledgment Receipt",
    "About",
    "Pending AR",
    "System Check",
    "Trust Log"
  ].map((name) => name.toLowerCase())
);

/** System tabs kept when scrubbing a copied tasks workbook. */
export const TASKS_SYSTEM_TABS = new Set(
  [
    TASK_SHEETS.tasks,
    TASK_SHEETS.events,
    TASK_SHEETS.employees,
    "Settings",
    "Dashboard",
    "About"
  ].map((name) => name.toLowerCase())
);

/** Remove client ledger tabs and clear row data from operational tabs. */
export async function scrubBillingWorkbook(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  deletedClientTabs: number;
  failedClientTabs: number;
  clearedTabs: string[];
  removedProtection: number;
}> {
  const removedProtection = await removeWorkbookProtection(accessToken, spreadsheetId);
  const workbookSheets = await listWorkbookSheets(accessToken, spreadsheetId);
  const clientTabIds = workbookSheets
    .filter((sheet) => !BILLING_SYSTEM_TABS.has(sheet.title.toLowerCase()))
    .map((sheet) => sheet.sheetId);

  const { deleted: deletedClientTabs, failed: failedClientTabs } = await deleteSheetsById(
    accessToken,
    spreadsheetId,
    clientTabIds
  );

  const dataTabs = [
    GL.sheets.master,
    GL.sheets.walkIn,
    GL.sheets.spotBilling,
    GL.sheets.notarization,
    GL.sheets.fieldDispatch,
    GL.sheets.documentLog,
    GL.sheets.auditLog,
    "Pending AR"
  ];

  const titles = new Set(workbookSheets.map((sheet) => sheet.title));
  const clearedTabs: string[] = [];

  for (const tab of dataTabs) {
    if (!titles.has(tab)) continue;
    try {
      await clearDataRows(accessToken, spreadsheetId, tab);
      clearedTabs.push(tab);
    } catch (error) {
      const message = apiErrorMessage(error);
      if (/protected/i.test(message)) {
        throw new Error(
          `Could not clear "${tab}" — sheet is still protected. Use --copy-first (recommended) or remove protection manually in Google Sheets, then re-run.`
        );
      }
      throw error;
    }
  }

  if (titles.has(GL.sheets.dashboard)) {
    try {
      await clearDataRows(accessToken, spreadsheetId, GL.sheets.dashboard);
      clearedTabs.push(GL.sheets.dashboard);
    } catch (error) {
      const message = apiErrorMessage(error);
      if (/protected/i.test(message)) {
        throw new Error(
          `Could not clear Dashboard — sheet is still protected. Use --copy-first (recommended) or remove protection manually, then re-run.`
        );
      }
      throw error;
    }
  }

  return { deletedClientTabs, failedClientTabs, clearedTabs, removedProtection };
}

async function countMasterListClients(accessToken: string, spreadsheetId: string): Promise<number> {
  const sheets = getSheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetTitle(GL.sheets.master)}!A2:A5000`
  });
  return (response.data.values || []).filter((row) => String(row[0] ?? "").trim()).length;
}

export async function assertBillingWorkbookIsBlank(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  const workbookSheets = await listWorkbookSheets(accessToken, spreadsheetId);
  const extraTabs = workbookSheets
    .map((sheet) => sheet.title)
    .filter((title) => !BILLING_SYSTEM_TABS.has(title.toLowerCase()));

  if (extraTabs.length) {
    throw new Error(
      `Billing workbook still has client ledger tabs (${extraTabs.slice(0, 5).join(", ")}${extraTabs.length > 5 ? "…" : ""}). Copy from a blank template — not the live GL billing file.`
    );
  }

  const clientRows = await countMasterListClients(accessToken, spreadsheetId);
  if (clientRows > 0) {
    throw new Error(
      `Billing workbook still has ${clientRows} row(s) on Master List. Use GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID pointing at a scrubbed blank template.`
    );
  }
}

export async function scrubTasksWorkbook(
  accessToken: string,
  spreadsheetId: string
): Promise<{ clearedTabs: string[]; removedProtection: number }> {
  const removedProtection = await removeWorkbookProtection(accessToken, spreadsheetId);
  const workbookSheets = await listWorkbookSheets(accessToken, spreadsheetId);
  const titles = new Set(workbookSheets.map((sheet) => sheet.title));

  const extraTabIds = workbookSheets
    .filter((sheet) => !TASKS_SYSTEM_TABS.has(sheet.title.toLowerCase()))
    .map((sheet) => sheet.sheetId);
  await deleteSheetsById(accessToken, spreadsheetId, extraTabIds);

  const clearedTabs: string[] = [];
  for (const tab of [TASK_SHEETS.tasks, TASK_SHEETS.events, TASK_SHEETS.employees]) {
    if (!titles.has(tab)) continue;
    await clearDataRows(accessToken, spreadsheetId, tab);
    clearedTabs.push(tab);
  }

  return { clearedTabs, removedProtection };
}
