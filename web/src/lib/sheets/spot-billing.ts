import {
  GL,
  normalizePaymentMethod,
  parseMoney,
  type SpotBillingEntry,
  type SpotBillingPayload,
  type SpotBillingTransactionPayload
} from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { walkInBillingStatus } from "@/lib/sheets/walk-ins";
import { ensureSheetTitle } from "@/lib/sheets/sheet-meta";

const SPOT_HEADERS = [...GL.spotBillingHeaders];
const SPOT_COLS = SPOT_HEADERS.length;
const SPOT_HEADER_RANGE = `A1:P1`;

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

function padSpotRow(values: unknown[]): unknown[] {
  const row = values.slice();
  while (row.length < SPOT_COLS) row.push("");
  return row;
}

function rowToSpotBilling(row: unknown[], rowNumber: number): SpotBillingEntry {
  return {
    spotId: cell(row, 0),
    dateAdded: cell(row, 1),
    payerName: cell(row, 2),
    serviceDescription: cell(row, 3),
    phone: cell(row, 4),
    email: cell(row, 5),
    notes: cell(row, 6),
    status: cell(row, 7) || "Active",
    linkedClientCode: cell(row, 8),
    chargeAmount: numCell(row, 9),
    paymentAmount: numCell(row, 10),
    paymentMethod: cell(row, 11),
    lastBillingDate: cell(row, 12),
    billingStatus: cell(row, 13),
    serviceType: cell(row, 14),
    assignedAttorney: cell(row, 15),
    rowNumber
  };
}

async function ensureSpotBillingSheetReady(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.spotBilling;
  await ensureSheetTitle(accessToken, sheetName);

  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, SPOT_HEADER_RANGE));
  const firstHeader = headerRow[0]?.[0] && String(headerRow[0][0]).trim();

  if (!firstHeader) {
    await updateSheetValues(accessToken, toA1Range(sheetName, SPOT_HEADER_RANGE), [SPOT_HEADERS]);
    return;
  }

  const existingCount = headerRow[0]?.filter((v) => v !== "" && v !== null && v !== undefined).length || 0;
  if (existingCount < SPOT_COLS) {
    await updateSheetValues(accessToken, toA1Range(sheetName, SPOT_HEADER_RANGE), [SPOT_HEADERS]);
  }
}

async function nextSpotId(accessToken: string): Promise<string> {
  const sheetName = GL.sheets.spotBilling;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:A"));
  let max = 0;
  for (const row of values) {
    const id = cell(row, 0).toUpperCase();
    const match = id.match(/^SPOT-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SPOT-${String(max + 1).padStart(4, "0")}`;
}

function findSpotEntry(entries: SpotBillingEntry[], spotId: string): SpotBillingEntry {
  const id = spotId.trim().toUpperCase();
  const entry = entries.find((row) => row.spotId.toUpperCase() === id);
  if (!entry) throw new Error(`Spot billing entry not found: ${spotId}`);
  return entry;
}

function resolveTransactionKind(
  billing: SpotBillingTransactionPayload
): import("@/lib/gl-config").SpotBillingTransactionKind {
  if (billing.transactionKind === "payment") return "payment";
  if (billing.transactionKind === "retainer" || billing.billingKind === "retainer") return "retainer";
  return "charge";
}

function spotBillingStatus(chargeAmount: number, paymentAmount: number, isRetainer: boolean): string {
  if (isRetainer) return "Retainer";
  if (chargeAmount <= 0 && paymentAmount > 0) return "Payment recorded";
  if (chargeAmount <= 0) return "";
  return walkInBillingStatus(chargeAmount, paymentAmount);
}

function parseTransactionAmounts(billing: SpotBillingTransactionPayload): {
  charge: number;
  payment: number;
  method: string;
  billingDate: string;
  serviceType: string;
  isRetainer: boolean;
  transactionKind: import("@/lib/gl-config").SpotBillingTransactionKind;
} {
  const transactionKind = resolveTransactionKind(billing);
  const isRetainer = transactionKind === "retainer";
  const billingDate = billing.date?.trim() || todayYmd();
  const serviceType = billing.serviceType?.trim() || "Professional Fee";
  const method =
    transactionKind === "payment" && billing.method?.trim()
      ? normalizePaymentMethod(billing.method) || billing.method.trim()
      : "";

  if (!serviceType) throw new Error("Service type is required.");

  if (isRetainer) {
    return { charge: 0, payment: 0, method: "", billingDate, serviceType, isRetainer, transactionKind };
  }

  if (transactionKind === "payment") {
    const payment = parseMoney(billing.payment);
    if (!payment || payment <= 0) throw new Error("Enter a valid payment amount.");
    if (!method) throw new Error("Payment method is required.");
    return { charge: 0, payment, method, billingDate, serviceType, isRetainer, transactionKind };
  }

  const charge = parseMoney(billing.charge);
  if (!charge || charge <= 0) throw new Error("Enter a valid charge amount.");
  return { charge, payment: 0, method: "", billingDate, serviceType, isRetainer, transactionKind };
}

export function accumulateSpotBillingTotals(
  entry: Pick<SpotBillingEntry, "chargeAmount" | "paymentAmount" | "paymentMethod" | "serviceType">,
  billing: SpotBillingTransactionPayload
): {
  chargeAmount: number;
  paymentAmount: number;
  paymentMethod: string;
  lastBillingDate: string;
  billingStatus: string;
  serviceType: string;
} {
  const { charge, payment, method, billingDate, serviceType, isRetainer } = parseTransactionAmounts(billing);
  const chargeAmount = entry.chargeAmount + charge;
  const paymentAmount = entry.paymentAmount + payment;
  const paymentMethod = method || entry.paymentMethod;
  const billingStatus = spotBillingStatus(chargeAmount, paymentAmount, isRetainer);

  return {
    chargeAmount,
    paymentAmount,
    paymentMethod,
    lastBillingDate: billingDate,
    billingStatus,
    serviceType: serviceType || entry.serviceType
  };
}

function appendTransactionNote(
  notes: string,
  billing: SpotBillingTransactionPayload,
  billingDate: string,
  serviceType: string,
  charge: number,
  payment: number,
  transactionKind: import("@/lib/gl-config").SpotBillingTransactionKind
): string {
  const parts = [`[${billingDate}] ${serviceType}`];
  if (billing.description?.trim()) parts.push(billing.description.trim());
  if (transactionKind === "charge" && charge > 0) parts.push(`charge ${charge}`);
  if (transactionKind === "payment" && payment > 0) parts.push(`payment ${payment}`);
  if (transactionKind === "retainer") parts.push("retainer note");
  const line = parts.join(" · ");
  return notes ? `${notes}\n${line}` : line;
}

async function writeSpotBillingRow(
  accessToken: string,
  entry: SpotBillingEntry,
  updates: {
    notes: string;
    chargeAmount: number;
    paymentAmount: number;
    paymentMethod: string;
    lastBillingDate: string;
    billingStatus: string;
    serviceType: string;
    status?: string;
    linkedClientCode?: string;
  }
): Promise<SpotBillingEntry> {
  await updateSheetValues(accessToken, toA1Range(GL.sheets.spotBilling, `G${entry.rowNumber}:O${entry.rowNumber}`), [
    [
      updates.notes,
      updates.status ?? entry.status,
      updates.linkedClientCode ?? entry.linkedClientCode,
      updates.chargeAmount,
      updates.paymentAmount || "",
      updates.paymentMethod,
      updates.lastBillingDate,
      updates.billingStatus,
      updates.serviceType
    ]
  ]);

  return {
    ...entry,
    notes: updates.notes,
    status: updates.status ?? entry.status,
    linkedClientCode: updates.linkedClientCode ?? entry.linkedClientCode,
    chargeAmount: updates.chargeAmount,
    paymentAmount: updates.paymentAmount,
    paymentMethod: updates.paymentMethod,
    lastBillingDate: updates.lastBillingDate,
    billingStatus: updates.billingStatus,
    serviceType: updates.serviceType
  };
}

export async function listSpotBillingEntries(accessToken: string): Promise<SpotBillingEntry[]> {
  await ensureSpotBillingSheetReady(accessToken);
  const values = await getSheetValues(accessToken, toA1Range(GL.sheets.spotBilling, "A2:P"));
  return values
    .map((row, index) => rowToSpotBilling(row, index + 2))
    .filter((entry) => entry.spotId);
}

export async function createSpotBillingEntry(
  accessToken: string,
  payload: SpotBillingPayload
): Promise<SpotBillingEntry> {
  const payerName = payload.payerName?.trim();
  const serviceDescription = payload.serviceDescription?.trim();
  if (!payerName) throw new Error("Payer name is required.");
  if (!serviceDescription) throw new Error("Service or matter description is required.");

  await ensureSpotBillingSheetReady(accessToken);
  const spotId = await nextSpotId(accessToken);
  const dateAdded = todayYmd();
  const assignedAttorney = payload.assignedAttorney?.trim() || "";

  const row = padSpotRow([
    spotId,
    dateAdded,
    payerName,
    serviceDescription,
    payload.phone?.trim() || "",
    payload.email?.trim() || "",
    payload.notes?.trim() || "",
    "Active",
    payload.linkedClientCode?.trim().toUpperCase() || "",
    "",
    "",
    "",
    "",
    "",
    "",
    assignedAttorney
  ]);

  await appendSheetValues(accessToken, toA1Range(GL.sheets.spotBilling, "A:P"), [row]);

  if (payload.billing) {
    return addSpotBillingTransaction(accessToken, spotId, payload.billing);
  }

  const entries = await listSpotBillingEntries(accessToken);
  return findSpotEntry(entries, spotId);
}

export async function addSpotBillingTransaction(
  accessToken: string,
  spotId: string,
  billing: SpotBillingTransactionPayload
): Promise<SpotBillingEntry> {
  const entries = await listSpotBillingEntries(accessToken);
  const entry = findSpotEntry(entries, spotId);

  if (entry.status === "Closed") {
    throw new Error(`Spot billing ${spotId} is closed.`);
  }

  const { charge, payment, method, billingDate, serviceType, isRetainer, transactionKind } =
    parseTransactionAmounts(billing);
  const totals = accumulateSpotBillingTotals(entry, billing);
  const notes = appendTransactionNote(
    entry.notes,
    billing,
    billingDate,
    serviceType,
    charge,
    payment,
    transactionKind
  );

  return writeSpotBillingRow(accessToken, entry, {
    notes,
    ...totals
  });
}

export async function getSpotBillingEntry(accessToken: string, spotId: string): Promise<SpotBillingEntry> {
  const entries = await listSpotBillingEntries(accessToken);
  return findSpotEntry(entries, spotId);
}

export async function closeSpotBillingEntry(accessToken: string, spotId: string): Promise<SpotBillingEntry> {
  const entries = await listSpotBillingEntries(accessToken);
  const entry = findSpotEntry(entries, spotId);
  if (entry.status === "Closed") return entry;

  await updateSheetValues(accessToken, toA1Range(GL.sheets.spotBilling, `H${entry.rowNumber}`), [["Closed"]]);
  return { ...entry, status: "Closed" };
}
