import {
  DEFAULT_FIELD_DISPATCH_STAFF,
  GL,
  fieldDispatchBillableTotal,
  fieldDispatchHasReturnedInput,
  fieldDispatchIsReconciled,
  fieldDispatchSalaryCreditForEntry,
  fieldDispatchSpentAmount,
  normalizeFieldDispatchDays,
  parseFieldDispatchStaffSalaryPaid,
  parseMoney,
  type FieldDispatchEntry,
  type FieldDispatchEditPayload,
  type FieldDispatchPayload,
  type FieldDispatchReconcilePayload
} from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { ensureSheetTitle } from "@/lib/sheets/sheet-meta";

const HEADERS = [...GL.fieldDispatchHeaders];
const COLS = HEADERS.length;
const HEADER_RANGE = `A1:S1`;
const DATA_RANGE = `A2:S`;
const APPEND_RANGE = `A:S`;

function todayYmd(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numCell(row: unknown[], index: number): number {
  return parseMoney(row[index]) || 0;
}

/** Rows saved before the Days column use location at index 2; newer rows store days at 2. */
function rowDaysColumnOffset(row: unknown[]): number {
  const col2 = cell(row, 2);
  const n = Number(col2);
  if (
    col2 !== "" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= 14 &&
    /^\d+$/.test(col2) &&
    cell(row, 3) !== ""
  ) {
    return 1;
  }
  return 0;
}

function rowToEntry(row: unknown[], rowNumber: number): FieldDispatchEntry {
  const off = rowDaysColumnOffset(row);
  const days = off ? normalizeFieldDispatchDays(numCell(row, 2)) : 1;
  const advanceGiven = numCell(row, 6 + off);
  const returnedToOffice = numCell(row, 8 + off);
  const serviceFee = numCell(row, 9 + off);
  const status = cell(row, 15 + off) || "Active";
  const staffSalaryPaid = parseFieldDispatchStaffSalaryPaid(cell(row, 16 + off));
  const staffSalaryPaidDate = cell(row, 17 + off);
  const reconciled = fieldDispatchIsReconciled({
    status,
    actualExpenses: numCell(row, 7 + off),
    returnedToOffice
  });
  const actualExpenses = reconciled ? fieldDispatchSpentAmount(advanceGiven, returnedToOffice) : 0;
  const billableTotal = reconciled
    ? fieldDispatchBillableTotal(advanceGiven, returnedToOffice, serviceFee, true)
    : Math.max(0, serviceFee);
  return {
    dispatchId: cell(row, 0),
    date: cell(row, 1),
    days,
    location: cell(row, 2 + off),
    staff: cell(row, 3 + off),
    clientCode: cell(row, 4 + off),
    purpose: cell(row, 5 + off),
    advanceGiven,
    actualExpenses,
    returnedToOffice,
    serviceFee,
    billableTotal,
    reimbursementStatus: cell(row, 11 + off) || "Open",
    billedDate: cell(row, 12 + off),
    notes: cell(row, 13 + off),
    recordedBy: cell(row, 14 + off),
    status,
    staffSalaryPaid,
    staffSalaryPaidDate,
    rowNumber
  };
}

function entryToRow(entry: FieldDispatchEntry): unknown[] {
  return padRow([
    entry.dispatchId,
    entry.date,
    entry.days,
    entry.location,
    entry.staff,
    entry.clientCode,
    entry.purpose,
    entry.advanceGiven,
    entry.actualExpenses,
    entry.returnedToOffice,
    entry.serviceFee,
    entry.billableTotal,
    entry.reimbursementStatus,
    entry.billedDate,
    entry.notes,
    entry.recordedBy,
    entry.status,
    entry.staffSalaryPaid ? "Yes" : "",
    entry.staffSalaryPaidDate
  ]);
}

function padRow(values: unknown[]): unknown[] {
  const row = values.slice();
  while (row.length < COLS) row.push("");
  return row;
}

async function ensureSheetReady(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.fieldDispatch;
  await ensureSheetTitle(accessToken, sheetName);

  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, HEADER_RANGE));
  const firstHeader = headerRow[0]?.[0] && String(headerRow[0][0]).trim();

  if (!firstHeader) {
    await updateSheetValues(accessToken, toA1Range(sheetName, HEADER_RANGE), [HEADERS]);
    return;
  }

  const existingCount = headerRow[0]?.filter((v) => v !== "" && v !== null && v !== undefined).length || 0;
  if (existingCount < COLS) {
    await updateSheetValues(accessToken, toA1Range(sheetName, HEADER_RANGE), [HEADERS]);
  }
}

async function nextDispatchId(accessToken: string): Promise<string> {
  const sheetName = GL.sheets.fieldDispatch;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:A"));
  let max = 0;
  for (const row of values) {
    const id = cell(row, 0).toUpperCase();
    const match = id.match(/^FD-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FD-${String(max + 1).padStart(4, "0")}`;
}

export async function listFieldDispatches(accessToken: string): Promise<FieldDispatchEntry[]> {
  await ensureSheetReady(accessToken);
  const sheetName = GL.sheets.fieldDispatch;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, DATA_RANGE));
  return values
    .map((row, index) => rowToEntry(row, index + 2))
    .filter((entry) => Boolean(entry.dispatchId) && entry.status !== "Deleted");
}

async function findByDispatchId(
  accessToken: string,
  dispatchId: string
): Promise<FieldDispatchEntry | null> {
  const target = dispatchId.trim().toUpperCase();
  if (!target) return null;
  const entries = await listFieldDispatches(accessToken);
  return entries.find((e) => e.dispatchId.toUpperCase() === target) || null;
}

export async function createFieldDispatch(
  accessToken: string,
  payload: FieldDispatchPayload,
  recordedBy: string
): Promise<FieldDispatchEntry> {
  await ensureSheetReady(accessToken);
  const sheetName = GL.sheets.fieldDispatch;

  const location = String(payload.location || "").trim();
  const purpose = String(payload.purpose || "").trim();
  if (!location) throw new Error("Location is required.");
  if (!purpose) throw new Error("Purpose is required.");

  const advanceGiven = parseMoney(payload.advanceGiven);
  const hasReturned = fieldDispatchHasReturnedInput(payload.returnedToOffice);
  const returnedToOffice = hasReturned ? parseMoney(payload.returnedToOffice) : 0;
  const serviceFee = parseMoney(payload.serviceFee);

  if (advanceGiven < 0 || returnedToOffice < 0 || serviceFee < 0) {
    throw new Error("Amounts cannot be negative.");
  }
  if (hasReturned && returnedToOffice > advanceGiven) {
    throw new Error("Returned amount cannot exceed advance given.");
  }

  const dispatchId = await nextDispatchId(accessToken);
  const date = payload.date?.trim() || todayYmd();
  const days = normalizeFieldDispatchDays(payload.days);
  const reconciled = hasReturned;
  const actualExpenses = reconciled ? fieldDispatchSpentAmount(advanceGiven, returnedToOffice) : 0;
  const billable = fieldDispatchBillableTotal(advanceGiven, returnedToOffice, serviceFee, reconciled);
  const status = reconciled ? "Reconciled" : "Active";
  const staffSalaryPaid = Boolean(payload.staffSalaryPaid);

  const row = padRow([
    dispatchId,
    date,
    days,
    location,
    payload.staff?.trim() || DEFAULT_FIELD_DISPATCH_STAFF,
    payload.clientCode?.trim().toUpperCase() || "",
    purpose,
    advanceGiven,
    actualExpenses,
    returnedToOffice,
    serviceFee,
    billable,
    "Open",
    "",
    payload.notes?.trim() || "",
    recordedBy,
    status,
    staffSalaryPaid ? "Yes" : "",
    staffSalaryPaid ? date : ""
  ]);

  await appendSheetValues(accessToken, toA1Range(sheetName, APPEND_RANGE), [row]);
  const created = await findByDispatchId(accessToken, dispatchId);
  if (!created) throw new Error("Dispatch was saved but could not be read back.");
  return created;
}

export async function updateFieldDispatch(
  accessToken: string,
  payload: FieldDispatchEditPayload
): Promise<FieldDispatchEntry> {
  const dispatchId = payload.dispatchId?.trim() || "";
  if (!dispatchId) throw new Error("Dispatch ID is required.");

  const entry = await findByDispatchId(accessToken, dispatchId);
  if (!entry) throw new Error(`Dispatch ${dispatchId} not found.`);

  if (entry.reimbursementStatus === "Paid" || entry.status === "Closed") {
    throw new Error("Paid dispatches cannot be edited.");
  }

  const location = String(payload.location || "").trim();
  const purpose = String(payload.purpose || "").trim();
  if (!location) throw new Error("Location is required.");
  if (!purpose) throw new Error("Purpose is required.");

  const isBilled = entry.reimbursementStatus === "Billed";
  const date = payload.date?.trim() || entry.date;
  const days = normalizeFieldDispatchDays(payload.days ?? entry.days);
  const staff = payload.staff?.trim() || entry.staff;
  const clientCode =
    payload.clientCode !== undefined ? payload.clientCode.trim().toUpperCase() : entry.clientCode;
  const notes = payload.notes !== undefined ? payload.notes.trim() : entry.notes;

  const advanceGiven = isBilled ? entry.advanceGiven : parseMoney(payload.advanceGiven);
  const returnedToOffice = isBilled ? entry.returnedToOffice : parseMoney(payload.returnedToOffice);
  const serviceFee = isBilled ? entry.serviceFee : parseMoney(payload.serviceFee);

  if (!isBilled && (advanceGiven < 0 || returnedToOffice < 0 || serviceFee < 0)) {
    throw new Error("Amounts cannot be negative.");
  }
  if (!isBilled && returnedToOffice > advanceGiven) {
    throw new Error("Returned amount cannot exceed advance given.");
  }

  const returnedProvided =
    !isBilled && payload.returnedToOffice !== undefined && fieldDispatchHasReturnedInput(payload.returnedToOffice);
  const reconciled = fieldDispatchIsReconciled(entry) || returnedProvided;
  const advanceForMath = isBilled ? entry.advanceGiven : advanceGiven;
  const returnedForMath = isBilled ? entry.returnedToOffice : returnedToOffice;
  const feeForMath = isBilled ? entry.serviceFee : serviceFee;
  const actualExpenses = reconciled ? fieldDispatchSpentAmount(advanceForMath, returnedForMath) : 0;
  const billable = fieldDispatchBillableTotal(advanceForMath, returnedForMath, feeForMath, reconciled);
  const status = reconciled ? "Reconciled" : "Active";
  const sheetName = GL.sheets.fieldDispatch;
  const range = toA1Range(sheetName, `A${entry.rowNumber}:S${entry.rowNumber}`);

  const row = entryToRow({
    ...entry,
    date,
    days,
    location,
    staff,
    clientCode,
    purpose,
    advanceGiven,
    actualExpenses,
    returnedToOffice,
    serviceFee,
    billableTotal: billable,
    notes,
    status
  });

  await updateSheetValues(accessToken, range, [row]);
  const updated = await findByDispatchId(accessToken, dispatchId);
  if (!updated) throw new Error("Dispatch update failed.");
  return updated;
}

export async function reconcileFieldDispatch(
  accessToken: string,
  payload: FieldDispatchReconcilePayload
): Promise<FieldDispatchEntry> {
  const dispatchId = payload.dispatchId?.trim() || "";
  if (!dispatchId) throw new Error("Dispatch ID is required.");

  const entry = await findByDispatchId(accessToken, dispatchId);
  if (!entry) throw new Error(`Dispatch ${dispatchId} not found.`);

  const returnedToOffice = parseMoney(payload.returnedToOffice);
  if (returnedToOffice < 0) {
    throw new Error("Amounts cannot be negative.");
  }
  if (returnedToOffice > entry.advanceGiven) {
    throw new Error("Returned amount cannot exceed advance given.");
  }

  const actualExpenses = fieldDispatchSpentAmount(entry.advanceGiven, returnedToOffice);
  const billable = fieldDispatchBillableTotal(
    entry.advanceGiven,
    returnedToOffice,
    entry.serviceFee,
    true
  );
  const notes = payload.notes?.trim() ? payload.notes.trim() : entry.notes;
  const sheetName = GL.sheets.fieldDispatch;
  const range = toA1Range(sheetName, `A${entry.rowNumber}:S${entry.rowNumber}`);

  const row = entryToRow({
    ...entry,
    actualExpenses,
    returnedToOffice,
    billableTotal: billable,
    notes,
    status: "Reconciled"
  });

  await updateSheetValues(accessToken, range, [row]);
  const updated = await findByDispatchId(accessToken, dispatchId);
  if (!updated) throw new Error("Dispatch update failed.");
  return updated;
}

export async function markFieldDispatchBilled(
  accessToken: string,
  dispatchId: string,
  billedDate?: string
): Promise<FieldDispatchEntry> {
  const entry = await findByDispatchId(accessToken, dispatchId);
  if (!entry) throw new Error(`Dispatch ${dispatchId} not found.`);
  if (!entry.clientCode) throw new Error("Client code is required before billing.");

  const sheetName = GL.sheets.fieldDispatch;
  const range = toA1Range(sheetName, `A${entry.rowNumber}:S${entry.rowNumber}`);
  const date = billedDate?.trim() || todayYmd();

  const row = entryToRow({
    ...entry,
    reimbursementStatus: "Billed",
    billedDate: date,
    status: "Reconciled"
  });

  await updateSheetValues(accessToken, range, [row]);
  const updated = await findByDispatchId(accessToken, dispatchId);
  if (!updated) throw new Error("Dispatch billing status update failed.");
  return updated;
}

/** Settle prepaid liaison trips created from letter / work-matter automations. */
export async function markFieldDispatchPrepaidOnCreate(
  accessToken: string,
  dispatchId: string,
  options: { advanceGiven?: number | string; serviceFee?: number | string }
): Promise<FieldDispatchEntry> {
  const advance = parseMoney(options.advanceGiven);
  if (advance > 0) {
    await reconcileFieldDispatch(accessToken, {
      dispatchId,
      actualExpenses: 0,
      returnedToOffice: advance,
      notes: "Advance settled — marked paid on create"
    });
  }
  const fee = parseMoney(options.serviceFee);
  if (fee > 0) {
    await setFieldDispatchStaffSalaryPaid(accessToken, dispatchId, true);
  }
  return updateFieldDispatchStatus(accessToken, dispatchId, "Paid");
}

export async function updateFieldDispatchStatus(
  accessToken: string,
  dispatchId: string,
  reimbursementStatus: string
): Promise<FieldDispatchEntry> {
  const entry = await findByDispatchId(accessToken, dispatchId);
  if (!entry) throw new Error(`Dispatch ${dispatchId} not found.`);

  const sheetName = GL.sheets.fieldDispatch;
  const range = toA1Range(sheetName, `A${entry.rowNumber}:S${entry.rowNumber}`);

  const row = entryToRow({
    ...entry,
    reimbursementStatus,
    status: reimbursementStatus === "Paid" ? "Closed" : entry.status
  });

  await updateSheetValues(accessToken, range, [row]);
  const updated = await findByDispatchId(accessToken, dispatchId);
  if (!updated) throw new Error("Dispatch status update failed.");
  return updated;
}

export async function setFieldDispatchStaffSalaryPaid(
  accessToken: string,
  dispatchId: string,
  paid: boolean
): Promise<FieldDispatchEntry> {
  const entry = await findByDispatchId(accessToken, dispatchId);
  if (!entry) throw new Error(`Dispatch ${dispatchId} not found.`);

  const credit = fieldDispatchSalaryCreditForEntry(entry);
  if (paid && credit <= 0) {
    throw new Error("Add a service fee before marking salary paid to staff.");
  }

  const sheetName = GL.sheets.fieldDispatch;
  const range = toA1Range(sheetName, `A${entry.rowNumber}:S${entry.rowNumber}`);
  const row = entryToRow({
    ...entry,
    staffSalaryPaid: paid,
    staffSalaryPaidDate: paid ? todayYmd() : ""
  });

  await updateSheetValues(accessToken, range, [row]);
  const updated = await findByDispatchId(accessToken, dispatchId);
  if (!updated) throw new Error("Dispatch update failed.");
  return updated;
}

export type FieldDispatchLocationStats = {
  location: string;
  tripCount: number;
  avgAdvance: number;
  /** Average food/fare spent (advance − returned) on reconciled trips. */
  avgExpenses: number;
  /** Average billable to client (spent + liaison fee) on reconciled trips. */
  avgBillable: number;
  avgReturned: number;
  lastDate: string;
  lastAdvance: number;
};

export function summarizeFieldDispatchesByLocation(
  entries: FieldDispatchEntry[]
): FieldDispatchLocationStats[] {
  const byLocation = new Map<string, FieldDispatchEntry[]>();
  for (const entry of entries) {
    const key = entry.location.trim() || "Other";
    const list = byLocation.get(key) || [];
    list.push(entry);
    byLocation.set(key, list);
  }

  return [...byLocation.entries()]
    .map(([location, trips]) => {
      const sorted = [...trips].sort((a, b) => b.date.localeCompare(a.date));
      const last = sorted[0];
      const count = trips.length;
      const reconciled = trips.filter((e) => fieldDispatchIsReconciled(e));
      const reconciledCount = reconciled.length;
      const sum = (list: FieldDispatchEntry[], pick: (e: FieldDispatchEntry) => number) =>
        list.reduce((acc, e) => acc + pick(e), 0);
      return {
        location,
        tripCount: count,
        avgAdvance: count ? sum(trips, (e) => e.advanceGiven) / count : 0,
        avgExpenses: reconciledCount ? sum(reconciled, (e) => e.actualExpenses) / reconciledCount : 0,
        avgBillable: reconciledCount ? sum(reconciled, (e) => e.billableTotal) / reconciledCount : 0,
        avgReturned: reconciledCount ? sum(reconciled, (e) => e.returnedToOffice) / reconciledCount : 0,
        lastDate: last?.date || "",
        lastAdvance: last?.advanceGiven || 0
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location));
}
