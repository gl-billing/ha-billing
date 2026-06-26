import { GL, parseMoney, sanitizeSheetName, type NewClientPayload } from "@/lib/gl-config";
import { normalizeClientCaseRole } from "@/lib/client-case-role";
import {
  caseTypeOtherRequired,
  normalizeClientCaseType
} from "@/lib/client-case-type";
import {
  caseTitleRequiredForMatterType,
  matterTypeCaseLabel,
  normalizeClientMatterType,
  resolveClientMatterType
} from "@/lib/client-matter-type";
import {
  getSheetValues,
  getSheetsClient,
  getSpreadsheetId,
  sheetExists
} from "@/lib/sheets/client";
import { invalidateCache } from "@/lib/sheets/cache";
import { ensureMasterListColumns, findMasterRow } from "@/lib/sheets/master";
import { updateSingleClientStatus } from "@/lib/sheets/ledger";
import { deleteSheetById, getSheetIdByTitle } from "@/lib/sheets/sheet-meta";

const TEMPLATE_SHEET = "Template";

function getFirstName(name: string): string {
  const clean = String(name || "Client").trim();
  return clean.split(/\s+/)[0] || "Client";
}

async function getSheetId(accessToken: string, title: string): Promise<number> {
  const id = await getSheetIdByTitle(accessToken, title);
  if (id === null) throw new Error(`Sheet not found: ${title}`);
  return id;
}

async function getMasterNextRow(accessToken: string): Promise<number> {
  const values = await getSheetValues(accessToken, `'${GL.sheets.master}'!A2:A`);
  return 2 + values.length;
}

function masterRowValues(payload: NewClientPayload, clientCode: string): unknown[] {
  const prevBalance = parseMoney(payload.prevBalance) || 0;
  const greeting = payload.preferredGreeting?.trim() || getFirstName(payload.clientName);
  const matterType = resolveClientMatterType({
    matterType: payload.matterType,
    caseTitle: payload.caseTitle
  });
  const caseTitle = caseTitleRequiredForMatterType(matterType)
    ? matterTypeCaseLabel(matterType, payload.caseTitle)
    : "";

  const row: unknown[] = new Array(GL.masterHeaders.length).fill("");
  row[0] = clientCode;
  row[1] = payload.clientName.trim();
  row[2] = caseTitle;
  row[3] = payload.caseNumber?.trim() || "";
  row[4] = payload.contactEmail?.trim() || "";
  row[5] = payload.contactPhone?.trim() || "";
  row[6] = payload.clientAddress?.trim() || "";
  row[8] = prevBalance;
  row[15] = "Balance Due";
  row[16] = "No";
  row[19] = greeting;
  row[20] = payload.clientStatus?.trim() || "Active";
  row[21] = payload.courtPending?.trim() || "";
  row[26] = normalizeClientCaseRole(payload.caseRole);
  row[27] = payload.birthday?.trim() || "";
  row[29] = payload.psychologistName?.trim() || "";
  row[30] = payload.psychologistPhone?.trim() || "";
  row[31] = payload.psychologistAddress?.trim() || "";
  row[32] = normalizeClientMatterType(matterType);
  row[33] = caseTitleRequiredForMatterType(matterType)
    ? normalizeClientCaseType(payload.caseType)
    : "";
  row[34] =
    caseTitleRequiredForMatterType(matterType) && normalizeClientCaseType(payload.caseType) === "other"
      ? payload.caseTypeOther?.trim() || ""
      : "";
  return row;
}

async function duplicateTemplateTab(
  accessToken: string,
  clientCode: string
): Promise<{ sheetId: number; title: string }> {
  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getSpreadsheetId();
  const templateSheetId = await getSheetId(accessToken, TEMPLATE_SHEET);

  const duplicate = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: templateSheetId,
            newSheetName: clientCode
          }
        }
      ]
    }
  });

  const props = duplicate.data.replies?.[0]?.duplicateSheet?.properties;
  const newSheetId = props?.sheetId;
  const actualTitle = props?.title?.trim() || clientCode;

  if (newSheetId === undefined || newSheetId === null) {
    throw new Error(
      "Could not create client ledger tab. Check that your Google account can edit the spreadsheet and that a tab named Template exists."
    );
  }

  if (actualTitle !== clientCode) {
    await deleteSheetById(accessToken, newSheetId).catch(() => undefined);
    throw new Error(
      `Google renamed the ledger tab to "${actualTitle}" instead of "${clientCode}". Pick a different client code or remove the conflicting tab.`
    );
  }

  invalidateCache(accessToken, "sheet-titles");
  return { sheetId: newSheetId, title: actualTitle };
}

export async function applyLedgerTabSetup(
  accessToken: string,
  clientCode: string,
  newSheetId: number,
  masterRow: number
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getSpreadsheetId();
  const masterSheetId = await getSheetId(accessToken, GL.sheets.master);
  const esc = clientCode.replace(/"/g, '""');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateCells: {
            range: { sheetId: newSheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 12 },
            rows: [
              {
                values: GL.ledgerHeaders.map((h) => ({
                  userEnteredValue: { stringValue: h },
                  userEnteredFormat: {
                    backgroundColor: { red: 0.09, green: 0.09, blue: 0.09 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                    horizontalAlignment: "CENTER"
                  }
                }))
              }
            ],
            fields: "userEnteredValue,userEnteredFormat"
          }
        },
        {
          updateCells: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 },
            rows: [
              { values: [{ userEnteredValue: { formulaValue: `=IFERROR(VLOOKUP("${esc}", '${GL.sheets.master}'!A:U, 3, FALSE), "")` } }] },
              { values: [{ userEnteredValue: { formulaValue: `=IFERROR(VLOOKUP("${esc}", '${GL.sheets.master}'!A:U, 2, FALSE), "Client Name")` } }] },
              { values: [{ userEnteredValue: { formulaValue: `=IFERROR(VLOOKUP("${esc}", '${GL.sheets.master}'!A:U, 7, FALSE), "Client Address")` } }] },
              { values: [{ userEnteredValue: { formulaValue: `=IFERROR(VLOOKUP("${esc}", '${GL.sheets.master}'!A:U, 4, FALSE), "")` } }] }
            ],
            fields: "userEnteredValue"
          }
        },
        {
          updateCells: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 4, endColumnIndex: 5 },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: `=IFERROR(VLOOKUP("${esc}", '${GL.sheets.master}'!A:U, 9, FALSE), 0) + E3 - E2`
                    }
                  }
                ]
              },
              { values: [{ userEnteredValue: { formulaValue: "=SUM(F8:F)" } }] },
              { values: [{ userEnteredValue: { formulaValue: "=SUM(E8:E)" } }] }
            ],
            fields: "userEnteredValue"
          }
        },
        {
          updateCells: {
            range: { sheetId: newSheetId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 6, endColumnIndex: 7 },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: '=IF(ISBLANK(A8), "", SUM(R8C5:RC[-2]) - SUM(R8C6:RC[-1]))'
                    }
                  }
                ]
              }
            ],
            fields: "userEnteredValue"
          }
        },
        {
          updateCells: {
            range: {
              sheetId: masterSheetId,
              startRowIndex: masterRow - 1,
              endRowIndex: masterRow,
              startColumnIndex: 9,
              endColumnIndex: 12
            },
            rows: [
              {
                values: [
                  { userEnteredValue: { formulaValue: `=INDIRECT("'${esc}'!E3")` } },
                  { userEnteredValue: { formulaValue: `=INDIRECT("'${esc}'!E2")` } },
                  { userEnteredValue: { formulaValue: `=INDIRECT("'${esc}'!E1")` } }
                ]
              }
            ],
            fields: "userEnteredValue"
          }
        },
        {
          updateCells: {
            range: {
              sheetId: masterSheetId,
              startRowIndex: masterRow - 1,
              endRowIndex: masterRow,
              startColumnIndex: 17,
              endColumnIndex: 18
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      formulaValue: `=IFERROR(MAX(FILTER('${esc}'!A8:A, '${esc}'!A8:A<>"")), "")`
                    }
                  }
                ]
              }
            ],
            fields: "userEnteredValue"
          }
        }
      ]
    }
  });
}

async function writeMasterRow(
  accessToken: string,
  masterRow: number,
  payload: NewClientPayload,
  clientCode: string
): Promise<void> {
  if (payload.birthday?.trim()) {
    await ensureMasterListColumns(accessToken);
  }
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${GL.sheets.master}'!A${masterRow}:AC${masterRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [masterRowValues(payload, clientCode)] }
  });
}

async function clearMasterRow(accessToken: string, masterRow: number): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${GL.sheets.master}'!A${masterRow}:AC${masterRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [new Array(GL.masterHeaders.length).fill("")] }
  });
}

/** Create ledger tab from Template for a client already on Master List. */
export async function repairClientLedgerTab(
  accessToken: string,
  clientCode: string
): Promise<{ ok: true; message: string; clientCode: string }> {
  const code = sanitizeSheetName(clientCode);
  if (!code) throw new Error("Client code is required.");

  const found = await findMasterRow(accessToken, code);
  if (!found) {
    throw new Error(`Client "${code}" is not on Master List. Register them under New first.`);
  }

  if (await sheetExists(accessToken, code)) {
    throw new Error(`Ledger tab "${code}" already exists.`);
  }

  if (!(await sheetExists(accessToken, TEMPLATE_SHEET))) {
    throw new Error(
      `Missing "${TEMPLATE_SHEET}" tab. Run Billing System setup in the spreadsheet first.`
    );
  }

  let newSheetId: number | null = null;
  try {
    const duplicated = await duplicateTemplateTab(accessToken, code);
    newSheetId = duplicated.sheetId;
    await applyLedgerTabSetup(accessToken, code, newSheetId, found.row);
    await updateSingleClientStatus(accessToken, code);
    if (!(await sheetExists(accessToken, code))) {
      throw new Error(`Ledger tab "${code}" was not found after creation. Try again in a moment.`);
    }
  } catch (error) {
    if (newSheetId !== null) {
      await deleteSheetById(accessToken, newSheetId).catch(() => undefined);
    }
    throw error;
  }

  return {
    ok: true,
    message: `Ledger tab "${code}" created from Template. You can now bill and view the profile.`,
    clientCode: code
  };
}

export async function createClient(
  accessToken: string,
  payload: NewClientPayload
): Promise<{ ok: true; message: string; clientCode: string; masterRow: number }> {
  const clientCode = sanitizeSheetName(payload.clientCode);
  if (!clientCode) throw new Error("Client code is required.");
  if (!payload.clientName?.trim()) throw new Error("Client name is required.");

  if (await findMasterRow(accessToken, clientCode)) {
    if (!(await sheetExists(accessToken, clientCode))) {
      const repaired = await repairClientLedgerTab(accessToken, clientCode);
      return {
        ok: true,
        message: `Client "${clientCode}" was on Master List but missing a ledger tab — tab created now.`,
        clientCode: repaired.clientCode,
        masterRow: (await findMasterRow(accessToken, clientCode))!.row
      };
    }
    throw new Error(`Client code "${clientCode}" already exists in Master List.`);
  }

  if (await sheetExists(accessToken, clientCode)) {
    throw new Error(`A sheet tab named "${clientCode}" already exists.`);
  }

  if (!(await sheetExists(accessToken, TEMPLATE_SHEET))) {
    throw new Error(
      `Missing "${TEMPLATE_SHEET}" tab. Run Billing System setup in the spreadsheet first.`
    );
  }

  const masterRow = await getMasterNextRow(accessToken);
  let newSheetId: number | null = null;

  try {
    const duplicated = await duplicateTemplateTab(accessToken, clientCode);
    newSheetId = duplicated.sheetId;
    await writeMasterRow(accessToken, masterRow, payload, clientCode);
    await applyLedgerTabSetup(accessToken, clientCode, newSheetId, masterRow);
    await updateSingleClientStatus(accessToken, clientCode);
    if (!(await sheetExists(accessToken, clientCode))) {
      throw new Error(
        `Ledger tab "${clientCode}" was not found after creation. Wait a moment and use Profile → Create ledger tab.`
      );
    }
  } catch (error) {
    if (newSheetId !== null) {
      await deleteSheetById(accessToken, newSheetId).catch(() => undefined);
    }
    await clearMasterRow(accessToken, masterRow).catch(() => undefined);
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Could not finish creating client ${clientCode}: ${detail}`);
  }

  invalidateCache(accessToken, "clients");
  invalidateCache(accessToken, "sheet-titles");

  return {
    ok: true,
    message: `Client ${clientCode} added. Master List updated and ledger tab created.`,
    clientCode,
    masterRow
  };
}
