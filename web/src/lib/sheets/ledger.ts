import {
  GL,
  normalizePaymentMethod,
  parseMoney,
  sanitizeSheetName,
  type LedgerEditPayload,
  type LedgerEntryPayload
} from "@/lib/gl-config";
import {
  getSheetValues,
  sheetExists,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { findMasterRow, updateClientAccountStatus } from "@/lib/sheets/master";
import { isLedgerDateInClosedMonth, parseLedgerMonthToken } from "@/lib/firm-allocation";
import { readSettingsMap } from "@/lib/sheets/settings";

async function getNextLedgerRow(accessToken: string, clientCode: string): Promise<number> {
  const range = `'${clientCode}'!A${GL.ledgerStartRow}:A`;
  const values = await getSheetValues(accessToken, range);
  let nextRow = GL.ledgerStartRow;

  values.forEach((row, index) => {
    if (row[0]) nextRow = GL.ledgerStartRow + index + 1;
  });

  return nextRow;
}

async function getPendingArCountForClient(
  accessToken: string,
  clientCode: string
): Promise<number> {
  const ledger = await getSheetValues(accessToken, `'${clientCode}'!A${GL.ledgerStartRow}:L`);
  let count = 0;

  ledger.forEach((row) => {
    const isPayment = String(row[1] || "").toLowerCase() === "payment";
    const hasAmount = row[5] && Number(row[5]) > 0;
    const arSent = row[10];
    if (row[0] && isPayment && hasAmount && !arSent) count++;
  });

  return count;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function updateSingleClientStatus(
  accessToken: string,
  clientCode: string
): Promise<void> {
  const found = await findMasterRow(accessToken, clientCode);
  if (!found) return;

  const values = found.values;
  const today = new Date();
  let totalDue = Number(values[11]) || 0;

  const clientSheetExists = await sheetExists(accessToken, clientCode);
  if (clientSheetExists) {
    try {
      const summary = await getSheetValues(accessToken, toA1Range(clientCode, "E1"));
      if (summary[0]?.[0] !== undefined) {
        totalDue = Number(summary[0][0]) || totalDue;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (!/unable to parse range|spreadsheet formula problem/i.test(msg)) {
        throw error;
      }
      // Fall back to Master List column L when client-tab summary formulas are invalid.
    }
  }

  const nextFollowUp = values[18];
  const clientStatus = String(values[20] || "Active");
  const pendingAr = (await getPendingArCountForClient(accessToken, clientCode)) > 0;

  let accountStatus = "Paid";
  if (clientStatus.toLowerCase() === "closed") {
    accountStatus = "Closed";
  } else if (
    totalDue > 0 &&
    nextFollowUp &&
    new Date(String(nextFollowUp)) < startOfDay(today)
  ) {
    accountStatus = "Overdue";
  } else if (totalDue > 0) {
    accountStatus = "Balance Due";
  }

  await updateClientAccountStatus(accessToken, clientCode, accountStatus, pendingAr);
}

export async function addLedgerEntry(
  accessToken: string,
  entry: LedgerEntryPayload
): Promise<{ ok: true; message: string; row: number }> {
  const clientCode = sanitizeSheetName(entry.clientCode);
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error(`Client tab not found: ${clientCode}`);
  }

  const isPayment = entry.type.toLowerCase() === "payment";
  const amount = parseMoney(isPayment ? entry.payment : entry.charge);

  if (!amount || amount <= 0) {
    throw new Error("Enter a valid amount.");
  }

  const method = isPayment
    ? normalizePaymentMethod(entry.method || "") || entry.method || ""
    : "";

  const nextRow = await getNextLedgerRow(accessToken, clientCode);
  const dateValue = entry.date || new Date().toISOString().slice(0, 10);

  await updateSheetValues(accessToken, `'${clientCode}'!A${nextRow}:L${nextRow}`, [
    [
      dateValue,
      isPayment ? "Payment" : "Charge",
      entry.category || (isPayment ? "Payment" : "Professional Fee"),
      entry.description || (isPayment ? "Payment Received" : "Professional Fee"),
      isPayment ? "" : amount,
      isPayment ? amount : "",
      "",
      method,
      isPayment ? entry.details || "" : "",
      "",
      "",
      ""
    ]
  ]);

  await updateSheetValues(accessToken, `'${clientCode}'!G${nextRow}`, [
    [`=IF(ISBLANK(A${nextRow}), "", SUM($E$8:E${nextRow}) - SUM($F$8:F${nextRow}))`]
  ]);

  await updateSingleClientStatus(accessToken, clientCode);

  return {
    ok: true,
    message: `${isPayment ? "Payment" : "Charge"} added to ${clientCode}.`,
    row: nextRow
  };
}

async function getLedgerRow(
  accessToken: string,
  clientCode: string,
  sheetRow: number
): Promise<unknown[] | null> {
  if (sheetRow < GL.ledgerStartRow) return null;
  const values = await getSheetValues(accessToken, `'${clientCode}'!A${sheetRow}:L${sheetRow}`);
  return values[0] || null;
}

export async function editLedgerEntry(
  accessToken: string,
  payload: LedgerEditPayload
): Promise<{ ok: true; message: string }> {
  const clientCode = sanitizeSheetName(payload.clientCode);
  const sheetRow = payload.sheetRow;

  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error(`Client tab not found: ${clientCode}`);
  }

  const current = await getLedgerRow(accessToken, clientCode, sheetRow);
  if (!current || !current[0]) throw new Error("Ledger entry not found.");

  const currentType = String(current[1] || "").toLowerCase();
  if (currentType === "void") throw new Error("Cannot edit a voided entry.");

  if (payload.reclassifyIncome) {
    if (currentType !== "payment") {
      throw new Error("Only payment rows can be reclassified.");
    }
    const category = String(payload.category ?? current[2] ?? "").trim();
    const description = String(payload.description ?? current[3] ?? "").trim();
    if (!category) throw new Error("Income type is required.");

    const settingsMap = await readSettingsMap(accessToken);
    if (isLedgerDateInClosedMonth(current[0], settingsMap)) {
      const token = parseLedgerMonthToken(current[0]) || "that month";
      throw new Error(
        `This payment is in closed month ${token}. Reopen the month in Firm finances before relabeling.`
      );
    }

    await updateSheetValues(accessToken, `'${clientCode}'!C${sheetRow}:D${sheetRow}`, [
      [category, description || category]
    ]);
    return {
      ok: true,
      message: `Payment relabeled as ${category}${current[9] ? " (receipt link preserved)" : ""}.`
    };
  }

  const isPayment = currentType === "payment";
  const dateValue = payload.date ?? String(current[0]);
  const category = payload.category ?? String(current[2] || "");
  const description = payload.description ?? String(current[3] || "");
  const method = isPayment
    ? normalizePaymentMethod(payload.method || String(current[7] || "")) ||
      String(current[7] || "")
    : "";
  const details = isPayment ? payload.details ?? String(current[8] || "") : "";

  const charge: number | "" = isPayment ? "" : parseMoney(payload.charge ?? current[4]);
  const payment: number | "" = isPayment ? parseMoney(payload.payment ?? current[5]) : "";

  if (isPayment) {
    if (!payment || payment <= 0) throw new Error("Enter a valid payment amount.");
  } else if (!charge || charge <= 0) {
    throw new Error("Enter a valid charge amount.");
  }

  if (current[9] || current[10]) {
    throw new Error("Cannot edit an entry linked to an invoice or receipt. Void it instead.");
  }

  await updateSheetValues(accessToken, `'${clientCode}'!A${sheetRow}:L${sheetRow}`, [
    [
      dateValue,
      isPayment ? "Payment" : "Charge",
      category,
      description,
      isPayment ? "" : charge,
      isPayment ? payment : "",
      "",
      method,
      details,
      "",
      "",
      ""
    ]
  ]);

  await updateSheetValues(accessToken, `'${clientCode}'!G${sheetRow}`, [
    [`=IF(ISBLANK(A${sheetRow}), "", SUM($E$8:E${sheetRow}) - SUM($F$8:F${sheetRow}))`]
  ]);

  await updateSingleClientStatus(accessToken, clientCode);

  return { ok: true, message: `Entry on row ${sheetRow} updated.` };
}

export async function voidLedgerEntry(
  accessToken: string,
  clientCode: string,
  sheetRow: number
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);

  if (!(await sheetExists(accessToken, code))) {
    throw new Error(`Client tab not found: ${code}`);
  }

  const current = await getLedgerRow(accessToken, code, sheetRow);
  if (!current || !current[0]) throw new Error("Ledger entry not found.");

  const currentType = String(current[1] || "").toLowerCase();
  if (currentType === "void") throw new Error("Entry is already voided.");

  const originalDesc = String(current[3] || current[2] || "Entry");

  await updateSheetValues(accessToken, `'${code}'!A${sheetRow}:L${sheetRow}`, [
    [
      current[0],
      "Void",
      String(current[2] || ""),
      `[VOID] ${originalDesc}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  ]);

  await updateSheetValues(accessToken, `'${code}'!G${sheetRow}`, [
    [`=IF(ISBLANK(A${sheetRow}), "", SUM($E$8:E${sheetRow}) - SUM($F$8:F${sheetRow}))`]
  ]);

  await updateSingleClientStatus(accessToken, code);

  return { ok: true, message: `Entry on row ${sheetRow} voided.` };
}

/** Restore a voided ledger row from a snapshot taken before voiding. */
export async function restoreLedgerEntry(
  accessToken: string,
  clientCode: string,
  sheetRow: number,
  snapshot: {
    date: string;
    type: string;
    category: string;
    description: string;
    charge: number;
    payment: number;
    method: string;
    details: string;
    documentNumber: string;
    arSent: boolean;
    pdfLink: string;
  }
): Promise<{ ok: true; message: string }> {
  const code = sanitizeSheetName(clientCode);

  if (!(await sheetExists(accessToken, code))) {
    throw new Error(`Client tab not found: ${code}`);
  }

  const current = await getLedgerRow(accessToken, code, sheetRow);
  if (!current || !current[0]) throw new Error("Ledger entry not found.");
  if (String(current[1] || "").toLowerCase() !== "void") {
    throw new Error("Only voided entries can be restored.");
  }

  await updateSheetValues(accessToken, `'${code}'!A${sheetRow}:L${sheetRow}`, [
    [
      snapshot.date,
      snapshot.type,
      snapshot.category,
      snapshot.description,
      snapshot.charge || "",
      snapshot.payment || "",
      "",
      snapshot.method,
      snapshot.details,
      snapshot.documentNumber,
      snapshot.arSent ? "Yes" : "",
      snapshot.pdfLink
    ]
  ]);

  await updateSheetValues(accessToken, `'${code}'!G${sheetRow}`, [
    [`=IF(ISBLANK(A${sheetRow}), "", SUM($E$8:E${sheetRow}) - SUM($F$8:F${sheetRow}))`]
  ]);

  await updateSingleClientStatus(accessToken, code);

  return { ok: true, message: `Entry on row ${sheetRow} restored.` };
}
