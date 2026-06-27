import type { ClientDetail, ClientSummary, DashboardSummary, UpdateClientPayload } from "@/lib/gl-config";
import { GL, parseMoney, sanitizeSheetName } from "@/lib/gl-config";
import { normalizeClientCaseRole } from "@/lib/client-case-role";
import {
  caseTitleRequiredForMatterType,
  matterTypeCaseLabel,
  normalizeClientMatterType,
  resolveClientMatterType
} from "@/lib/client-matter-type";
import {
  caseTypeOtherRequired,
  normalizeClientCaseType
} from "@/lib/client-case-type";
import { pickBestClientRowForTaskCode } from "@/lib/sheets/task-code-client-match";
import { getHyperlinksByRow, resolvePdfUrl } from "@/lib/sheets/hyperlinks";
import { getSheetValues, getSheetsClient, getSpreadsheetId, updateSheetValues } from "@/lib/sheets/client";
import { withCache } from "@/lib/sheets/cache";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { canonicalizeStaffName } from "@/lib/staff-assignee";

const MASTER_COL_COUNT = GL.masterHeaders.length;

/** Extend Master List through column AI (case type fields) when the sheet stops short. */
export async function ensureMasterListColumns(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.master;
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties"
  });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  const colCount = sheet?.properties?.gridProperties?.columnCount || 0;
  if (sheetId === undefined || sheetId === null) return;
  if (colCount < MASTER_COL_COUNT) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { columnCount: MASTER_COL_COUNT }
              },
              fields: "gridProperties.columnCount"
            }
          }
        ]
      }
    });
  }

  const headerRow = await getSheetValues(accessToken, `'${sheetName}'!A1:AI1`);
  const existing = headerRow[0] || [];
  const patches: Array<{ range: string; values: string[][] }> = [];

  const birthdayHeader = String(existing[27] || "").trim();
  const greetingHeader = String(existing[28] || "").trim();
  if (!birthdayHeader || !greetingHeader) {
    patches.push({
      range: `'${sheetName}'!AB1:AC1`,
      values: [[GL.masterHeaders[27], GL.masterHeaders[28]]]
    });
  }

  const psychologistHeaders = [29, 30, 31].map((index) => String(existing[index] || "").trim());
  if (psychologistHeaders.some((header) => !header)) {
    patches.push({
      range: `'${sheetName}'!AD1:AF1`,
      values: [[GL.masterHeaders[29], GL.masterHeaders[30], GL.masterHeaders[31]]]
    });
  }

  if (!String(existing[32] || "").trim()) {
    patches.push({
      range: `'${sheetName}'!AG1`,
      values: [[GL.masterHeaders[32]]]
    });
  }

  if (!String(existing[33] || "").trim() || !String(existing[34] || "").trim()) {
    patches.push({
      range: `'${sheetName}'!AH1:AI1`,
      values: [[GL.masterHeaders[33], GL.masterHeaders[34]]]
    });
  }

  if (!String(existing[35] || "").trim()) {
    patches.push({
      range: `'${sheetName}'!AJ1`,
      values: [[GL.masterHeaders[35]]]
    });
  }

  if (patches.length) {
    for (const patch of patches) {
      await updateSheetValues(accessToken, patch.range, patch.values);
    }
  }
}

function rowToSummary(row: unknown[]): ClientSummary {
  return {
    code: String(row[0] || ""),
    name: String(row[1] || ""),
    caseTitle: String(row[2] || ""),
    caseNumber: String(row[3] || ""),
    balance: Number(row[11]) || 0,
    status: String(row[20] || "Active"),
    accountStatus: String(row[15] || ""),
    email: String(row[4] || ""),
    phone: String(row[5] || ""),
    address: String(row[6] || ""),
    assignedAttorney: String(row[22] || ""),
    coAssignedAttorney: String(row[35] || ""),
    retainerBalance: Number(row[23]) || 0,
    lastBillingDate: String(row[7] || ""),
    soaSent: String(row[12] || ""),
    courtPending: String(row[21] || ""),
    caseRole: normalizeClientCaseRole(String(row[26] || "")),
    birthday: formatBirthdayCell(row[27]),
    birthdayGreetingSent: String(row[28] || ""),
    psychologistName: String(row[29] || ""),
    psychologistPhone: String(row[30] || ""),
    psychologistAddress: String(row[31] || ""),
    matterType: resolveClientMatterType({
      matterType: String(row[32] || ""),
      caseTitle: String(row[2] || ""),
      retainerBalance: Number(row[23]) || 0
    }),
    caseType: normalizeClientCaseType(String(row[33] || "")),
    caseTypeOther: String(row[34] || "")
  };
}

function formatBirthdayCell(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000) {
    const utc = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
    const y = utc.getUTCFullYear();
    const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const d = String(utc.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return text;
}

function rowToDetail(row: unknown[], masterRow: number): ClientDetail {
  const summary = rowToSummary(row);
  return {
    ...summary,
    masterRow,
    prevBalance: Number(row[8]) || 0,
    newCharges: Number(row[9]) || 0,
    paymentsTotal: Number(row[10]) || 0,
    preferredGreeting: String(row[19] || ""),
    courtPending: String(row[21] || ""),
    lastBillingDate: String(row[7] || ""),
    nextFollowUp: String(row[18] || ""),
    lastInvoiceNumber: String(row[13] || ""),
    lastInvoiceUrl: String(row[14] || ""),
    soaSent: String(row[12] || ""),
    lastActivity: String(row[17] || ""),
    arPending: String(row[16] || ""),
    assignedAttorney: String(row[22] || ""),
    coAssignedAttorney: String(row[35] || ""),
    retainerBalance: Number(row[23]) || 0,
    closeReason: String(row[24] || ""),
    closedDate: String(row[25] || ""),
    birthday: formatBirthdayCell(row[27]),
    birthdayGreetingSent: String(row[28] || ""),
    psychologistName: String(row[29] || ""),
    psychologistPhone: String(row[30] || ""),
    psychologistAddress: String(row[31] || ""),
    matterType: resolveClientMatterType({
      matterType: String(row[32] || ""),
      caseTitle: String(row[2] || ""),
      retainerBalance: Number(row[23]) || 0
    }),
    caseType: normalizeClientCaseType(String(row[33] || "")),
    caseTypeOther: String(row[34] || "")
  };
}

export function filterMasterRowsByQuery(rows: unknown[][], query: string): unknown[][] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const haystack = [
      row[0],
      row[1],
      row[2],
      row[3],
      row[4],
      row[5],
      row[6],
      row[21],
      row[22],
      row[26],
      row[29],
      row[30],
      row[31],
      row[33],
      row[34],
      row[35]
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getClients(
  accessToken: string,
  options?: { includeClosed?: boolean }
): Promise<ClientSummary[]> {
  const values = await getAllMasterRows(accessToken);
  return values
    .filter((row) => row[0])
    .map(rowToSummary)
    .filter((c) => options?.includeClosed || c.status.toLowerCase() !== "closed");
}

export async function getAllMasterRows(accessToken: string): Promise<unknown[][]> {
  return withCache(accessToken, "master-rows", 45_000, () =>
    getSheetValues(accessToken, `'${GL.sheets.master}'!A2:AI`)
  );
}

export async function findMasterRow(
  accessToken: string,
  clientCode: string
): Promise<{ row: number; values: unknown[] } | null> {
  const data = await getAllMasterRows(accessToken);
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === clientCode.trim()) {
      return { row: i + 2, values: data[i] };
    }
  }
  return null;
}

export async function getClientDetail(
  accessToken: string,
  clientCode: string
): Promise<ClientDetail | null> {
  const found = await findMasterRow(accessToken, clientCode);
  if (!found) return null;

  const detail = rowToDetail(found.values, found.row);
  const hyperlinks = await getHyperlinksByRow(
    accessToken,
    `'${GL.sheets.master}'!O${found.row}`,
    found.row
  );
  detail.lastInvoiceUrl = resolvePdfUrl(detail.lastInvoiceUrl, hyperlinks.get(found.row));

  return detail;
}

/** Match billing Master List row from tasks client prefix (e.g. MAR). */
export async function findClientForTaskCode(
  accessToken: string,
  taskCode: string,
  caseHint?: string
): Promise<ClientDetail | null> {
  const code = taskCode.trim().toUpperCase();
  if (!code) return null;

  const exact = await getClientDetail(accessToken, code);
  if (exact) return exact;

  const rows = await getAllMasterRows(accessToken);
  const summaries = rows
    .map((row, index) => ({
      row,
      index,
      summary: {
        code: String(row[0] || ""),
        name: String(row[1] || ""),
        caseTitle: String(row[2] || ""),
        caseNumber: String(row[3] || "")
      }
    }))
    .filter((entry) => entry.summary.code.trim());

  const picked = pickBestClientRowForTaskCode(
    summaries.map((entry) => entry.summary),
    code,
    caseHint
  );
  if (!picked) return null;

  const match = summaries.find((entry) => entry.summary.code.trim().toUpperCase() === picked.code.trim().toUpperCase());
  if (!match) return null;

  return rowToDetail(match.row, match.index + 2);
}

export async function updateClient(
  accessToken: string,
  clientCode: string,
  payload: UpdateClientPayload
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);
  const found = await findMasterRow(accessToken, code);
  if (!found) throw new Error("Client not found in Master List.");

  const row = found.row;
  const current = found.values;

  const nextName = payload.clientName?.trim() ?? String(current[1] || "");
  const nextCase = payload.caseTitle?.trim() ?? String(current[2] || "");
  const nextCaseNo = payload.caseNumber?.trim() ?? String(current[3] || "");
  const nextEmail = payload.contactEmail?.trim() ?? String(current[4] || "");
  const nextPhone = payload.contactPhone?.trim() ?? String(current[5] || "");
  const nextAddress = payload.clientAddress?.trim() ?? String(current[6] || "");
  const nextPrev =
    payload.prevBalance !== undefined ? parseMoney(payload.prevBalance) : Number(current[8]) || 0;
  const nextGreeting = payload.preferredGreeting?.trim() ?? String(current[19] || "");
  const nextStatus = payload.clientStatus?.trim() ?? String(current[20] || "Active");
  const nextCourt = payload.courtPending?.trim() ?? String(current[21] || "");
  const nextCaseRole =
    payload.caseRole !== undefined
      ? normalizeClientCaseRole(payload.caseRole)
      : normalizeClientCaseRole(String(current[26] || ""));
  const roster = await getActiveEmployeeNames(accessToken);
  const nextAttorney =
    payload.assignedAttorney !== undefined
      ? canonicalizeStaffName(payload.assignedAttorney.trim(), roster)
      : String(current[22] || "");
  const nextCoAttorney =
    payload.coAssignedAttorney !== undefined
      ? canonicalizeStaffName(payload.coAssignedAttorney.trim(), roster)
      : String(current[35] || "");
  const nextRetainer =
    payload.retainerBalance !== undefined
      ? parseMoney(payload.retainerBalance)
      : Number(current[23]) || 0;
  const nextBirthday =
    payload.birthday !== undefined ? normalizeBirthdayInput(payload.birthday) : formatBirthdayCell(current[27]);
  const nextPsychologistName =
    payload.psychologistName !== undefined
      ? payload.psychologistName.trim()
      : String(current[29] || "");
  const nextPsychologistPhone =
    payload.psychologistPhone !== undefined
      ? payload.psychologistPhone.trim()
      : String(current[30] || "");
  const nextPsychologistAddress =
    payload.psychologistAddress !== undefined
      ? payload.psychologistAddress.trim()
      : String(current[31] || "");
  const nextMatterType =
    payload.matterType !== undefined
      ? normalizeClientMatterType(payload.matterType)
      : resolveClientMatterType({
          matterType: String(current[32] || ""),
          caseTitle: nextCase,
          retainerBalance: nextRetainer
        });
  const resolvedCaseTitle = caseTitleRequiredForMatterType(nextMatterType) ? nextCase : "";
  const nextCaseType = caseTitleRequiredForMatterType(nextMatterType)
    ? payload.caseType !== undefined
      ? normalizeClientCaseType(payload.caseType)
      : normalizeClientCaseType(String(current[33] || ""))
    : "";
  const nextCaseTypeOther =
    caseTitleRequiredForMatterType(nextMatterType) && nextCaseType === "other"
      ? payload.caseTypeOther !== undefined
        ? payload.caseTypeOther.trim()
        : String(current[34] || "")
      : "";

  if (!nextName) throw new Error("Client name is required.");
  if (caseTitleRequiredForMatterType(nextMatterType) && !resolvedCaseTitle) {
    throw new Error("Case title is required for an active case.");
  }
  if (caseTitleRequiredForMatterType(nextMatterType) && !nextCaseType) {
    throw new Error("Case type is required for an active case.");
  }
  if (caseTypeOtherRequired(nextCaseType) && !nextCaseTypeOther) {
    throw new Error("Please specify the case type.");
  }

  if (
    payload.birthday !== undefined ||
    payload.psychologistName !== undefined ||
    payload.psychologistPhone !== undefined ||
    payload.psychologistAddress !== undefined ||
    payload.matterType !== undefined ||
    payload.caseType !== undefined ||
    payload.caseTypeOther !== undefined ||
    payload.assignedAttorney !== undefined ||
    payload.coAssignedAttorney !== undefined
  ) {
    await ensureMasterListColumns(accessToken);
  }

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!B${row}:G${row}`, [
    [nextName, resolvedCaseTitle, nextCaseNo, nextEmail, nextPhone, nextAddress]
  ]);

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!I${row}`, [[nextPrev]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!T${row}:U${row}`, [
    [nextGreeting, nextStatus]
  ]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!V${row}:X${row}`, [
    [nextCourt, nextAttorney, nextRetainer]
  ]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AA${row}`, [[nextCaseRole]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AB${row}`, [[nextBirthday]]);
  await ensureMasterListColumns(accessToken);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AD${row}:AF${row}`, [
    [nextPsychologistName, nextPsychologistPhone, nextPsychologistAddress]
  ]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AG${row}`, [[nextMatterType]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AH${row}:AI${row}`, [
    [nextCaseType, nextCaseTypeOther]
  ]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AJ${row}`, [[nextCoAttorney]]);

  return { ok: true, message: `Client ${code} updated.` };
}

function normalizeBirthdayInput(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getDashboard(accessToken: string): Promise<DashboardSummary> {
  const data = await getAllMasterRows(accessToken);
  return dashboardFromMasterRows(data);
}

export function dashboardFromMasterRows(data: unknown[][]): DashboardSummary {
  const active = data.filter(
    (row) => row[0] && String(row[20] || "Active").toLowerCase() !== "closed"
  );

  const totalCollectibles = active.reduce((sum, row) => sum + (Number(row[11]) || 0), 0);
  const clientsWithBalance = active.filter((row) => Number(row[11]) > 0).length;
  const overdueClients = active.filter((row) => String(row[15]) === "Overdue").length;
  const paymentsRecorded = active.reduce((sum, row) => sum + (Number(row[10]) || 0), 0);

  const topBalances = active
    .filter((row) => Number(row[11]) > 0)
    .sort((a, b) => (Number(b[11]) || 0) - (Number(a[11]) || 0))
    .slice(0, 10)
    .map((row) => ({
      code: String(row[0]),
      name: String(row[1] || ""),
      caseTitle: String(row[2] || ""),
      totalDue: Number(row[11]) || 0,
      status: String(row[15] || "")
    }));

  return {
    totalCollectibles,
    clientsWithBalance,
    overdueClients,
    paymentsRecorded,
    topBalances
  };
}

export async function updateClientAccountStatus(
  accessToken: string,
  clientCode: string,
  accountStatus: string,
  arPending: boolean
): Promise<void> {
  const found = await findMasterRow(accessToken, clientCode);
  if (!found) return;

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!P${found.row}:Q${found.row}`, [
    [accountStatus, arPending ? "Yes" : "No"]
  ]);
}

export async function closeClient(
  accessToken: string,
  clientCode: string,
  reason: string
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);
  const found = await findMasterRow(accessToken, code);
  if (!found) throw new Error("Client not found.");

  const closedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!P${found.row}`, [["Closed"]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!U${found.row}`, [["Closed"]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!Y${found.row}:Z${found.row}`, [
    [reason.trim() || "Closed by staff", closedDate]
  ]);

  return { ok: true, message: `Client ${code} closed.` };
}

export async function reopenClient(
  accessToken: string,
  clientCode: string
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);
  const found = await findMasterRow(accessToken, code);
  if (!found) throw new Error("Client not found.");

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!U${found.row}`, [["Active"]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!Y${found.row}:Z${found.row}`, [["", ""]]);

  const { updateSingleClientStatus } = await import("@/lib/sheets/ledger");
  await updateSingleClientStatus(accessToken, code);

  return { ok: true, message: `Client ${code} reopened.` };
}
