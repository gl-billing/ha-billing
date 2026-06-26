import { GL, formatPeso, sanitizeSheetName } from "@/lib/gl-config";
import { getSheetsClient, getSpreadsheetId } from "@/lib/sheets/client";
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

function assertDeletableClientCode(code: string): void {
  if (!code) throw new Error("Client code is required.");
  if (PROTECTED_TABS.has(code.toLowerCase())) {
    throw new Error(`Cannot delete system sheet "${code}".`);
  }
}

export async function deleteClientPermanently(
  accessToken: string,
  clientCode: string,
  options?: { force?: boolean }
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);
  assertDeletableClientCode(code);

  const found = await findMasterRow(accessToken, code);
  if (!found) throw new Error("Client not found in Master List.");

  const totalDue = Number(found.values[11]) || 0;
  const arPending = String(found.values[16] || "")
    .trim()
    .toLowerCase() === "yes";

  if (!options?.force) {
    if (totalDue > 0.005) {
      throw new Error(
        `Cannot delete: total due is ${formatPeso(totalDue)}. Void entries to clear balance, or confirm forced delete as admin.`
      );
    }

    if (arPending) {
      throw new Error(
        "Cannot delete: client has pending acknowledgment receipt(s). Void payments or confirm forced delete as admin."
      );
    }
  }

  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getSpreadsheetId();
  const requests: Array<Record<string, unknown>> = [];

  if (await sheetTitleExists(accessToken, code)) {
    const sheetId = await getSheetIdByTitle(accessToken, code);
    if (sheetId !== null) {
      requests.push({ deleteSheet: { sheetId } });
    }
  }

  const masterSheetId = await getSheetIdByTitle(accessToken, GL.sheets.master);
  if (masterSheetId === null) {
    throw new Error("Master List sheet not found.");
  }

  requests.push({
    deleteDimension: {
      range: {
        sheetId: masterSheetId,
        dimension: "ROWS",
        startIndex: found.row - 1,
        endIndex: found.row
      }
    }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });

  return {
    ok: true,
    message: `Client ${code} permanently deleted (ledger tab and Master List row removed).`
  };
}
