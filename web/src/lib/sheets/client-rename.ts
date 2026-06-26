import { GL, sanitizeSheetName } from "@/lib/gl-config";
import { getSheetsClient, getSpreadsheetId, sheetExists } from "@/lib/sheets/client";
import { invalidateCache } from "@/lib/sheets/cache";
import { applyLedgerTabSetup } from "@/lib/sheets/clients-create";
import { findMasterRow } from "@/lib/sheets/master";
import { getSheetIdByTitle, sheetTitleExists } from "@/lib/sheets/sheet-meta";

const PROTECTED_TABS = new Set(
  [
    GL.sheets.settings,
    GL.sheets.master,
    GL.sheets.dashboard,
    GL.sheets.documentLog,
    GL.sheets.auditLog,
    "Template",
    "Invoice",
    "Acknowledgment Receipt",
    "About",
    "Pending AR",
    "System Check"
  ].map((s) => s.toLowerCase())
);

function assertRenamableClientCode(code: string): void {
  if (!code) throw new Error("Client code is required.");
  if (PROTECTED_TABS.has(code.toLowerCase())) {
    throw new Error(`Cannot use reserved sheet name "${code}".`);
  }
}

export function normalizeRenamedClientCode(value: string): string {
  return sanitizeSheetName(value);
}

export async function renameClientCode(
  accessToken: string,
  oldCode: string,
  newCode: string
): Promise<{ ok: true; oldCode: string; newCode: string; ledgerRenamed: boolean; message: string }> {
  const from = normalizeRenamedClientCode(oldCode);
  const to = normalizeRenamedClientCode(newCode);

  assertRenamableClientCode(from);
  assertRenamableClientCode(to);

  if (from === to) {
    throw new Error("New client code must be different from the current code.");
  }

  const found = await findMasterRow(accessToken, from);
  if (!found) {
    throw new Error(`Client "${from}" was not found in Master List.`);
  }

  if (await findMasterRow(accessToken, to)) {
    throw new Error(`Client code "${to}" is already used in Master List.`);
  }

  if (await sheetTitleExists(accessToken, to)) {
    throw new Error(`A sheet tab named "${to}" already exists. Pick a different code.`);
  }

  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${GL.sheets.master}'!A${found.row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[to]] }
  });

  let ledgerRenamed = false;
  const ledgerSheetId = (await sheetExists(accessToken, from))
    ? await getSheetIdByTitle(accessToken, from)
    : null;

  if (ledgerSheetId !== null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: ledgerSheetId, title: to },
              fields: "title"
            }
          }
        ]
      }
    });

    invalidateCache(accessToken, "sheet-titles");

    if (!(await sheetTitleExists(accessToken, to))) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${GL.sheets.master}'!A${found.row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[from]] }
      });
      throw new Error(
        `Could not rename ledger tab to "${to}". Pick a different client code or check for a naming conflict in Google Sheets.`
      );
    }

    await applyLedgerTabSetup(accessToken, to, ledgerSheetId, found.row);
    ledgerRenamed = true;
  }

  invalidateCache(accessToken, "clients");
  invalidateCache(accessToken, "home-dashboard");
  invalidateCache(accessToken, `profile:${from}`);
  invalidateCache(accessToken, `profile:${to}`);

  return {
    ok: true,
    oldCode: from,
    newCode: to,
    ledgerRenamed,
    message: ledgerRenamed
      ? `Client code renamed from ${from} to ${to} (Master List, ledger tab, and linked formulas updated).`
      : `Client code renamed from ${from} to ${to} on Master List. No ledger tab was found for ${from}.`
  };
}
