import {
  GL,
  normalizePaymentMethod,
  parseMoney,
  type NotarizationEntry,
  type NotarizationPayload,
  type NotarizationUpdatePayload
} from "@/lib/gl-config";
import type { GenerateNotarialReceiptPayload } from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import {
  formatNotarizationReceiptIssuedDate,
  NOTARIZATION_RETAINER_METHOD
} from "@/lib/notarization-utils";
import { generateNotarialReceiptNative } from "@/lib/sheets/notarial-receipt";
import { ensureSheetTitle } from "@/lib/sheets/sheet-meta";

const NOTARIZATION_HEADERS = [...GL.notarizationHeaders];
const NOTARIZATION_COLS = NOTARIZATION_HEADERS.length;
export const NOTARIZATION_DELETED_STATUS = "Deleted";
const NOTARIZATION_HEADER_RANGE = `A1:R1`;
const NOTARIZATION_DATA_RANGE = `A2:R`;
const NOTARIZATION_APPEND_RANGE = `A:R`;

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

function rowToNotarization(row: unknown[], rowNumber: number): NotarizationEntry {
  return {
    receiptNo: cell(row, 0),
    date: cell(row, 1),
    name: cell(row, 2),
    documentType: cell(row, 3),
    docNo: cell(row, 4),
    pageNo: cell(row, 5),
    bookNo: cell(row, 6),
    series: cell(row, 7),
    amount: numCell(row, 8),
    paymentMethod: cell(row, 9),
    paymentDetails: cell(row, 10),
    clientCode: cell(row, 11),
    notes: cell(row, 12),
    recordedBy: cell(row, 13),
    pdfLink: cell(row, 14),
    status: cell(row, 15) || "Recorded",
    address: cell(row, 16),
    receiptIssuedAt: cell(row, 17),
    rowNumber
  };
}

export function notarizationReceiptPayload(entry: NotarizationEntry): GenerateNotarialReceiptPayload {
  return {
    receiptNo: entry.receiptNo,
    date: entry.date,
    name: entry.name,
    address: entry.address || "",
    documentType: entry.documentType,
    docNo: entry.docNo,
    pageNo: entry.pageNo,
    bookNo: entry.bookNo,
    series: entry.series,
    amount: entry.amount,
    paymentMethod: entry.paymentMethod,
    paymentDetails: entry.paymentDetails
  };
}

function padRow(values: unknown[]): unknown[] {
  const row = values.slice();
  while (row.length < NOTARIZATION_COLS) row.push("");
  return row;
}

async function ensureNotarizationSheetReady(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.notarization;
  await ensureSheetTitle(accessToken, sheetName);

  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_HEADER_RANGE));
  const firstHeader = headerRow[0]?.[0] && String(headerRow[0][0]).trim();

  if (!firstHeader) {
    await updateSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_HEADER_RANGE), [NOTARIZATION_HEADERS]);
    return;
  }

  const existingCount = headerRow[0]?.filter((v) => v !== "" && v !== null && v !== undefined).length || 0;
  if (existingCount < NOTARIZATION_COLS) {
    await updateSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_HEADER_RANGE), [NOTARIZATION_HEADERS]);
  }
}

async function nextNotarizationReceiptNo(accessToken: string): Promise<string> {
  const sheetName = GL.sheets.notarization;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:A"));
  let max = 0;
  for (const row of values) {
    const id = cell(row, 0).toUpperCase();
    const match = id.match(/^NR-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `NR-${String(max + 1).padStart(4, "0")}`;
}

function isVisibleNotarization(entry: NotarizationEntry): boolean {
  return Boolean(entry.receiptNo) && entry.status !== NOTARIZATION_DELETED_STATUS;
}

export async function listNotarizations(accessToken: string): Promise<NotarizationEntry[]> {
  await ensureNotarizationSheetReady(accessToken);
  const sheetName = GL.sheets.notarization;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_DATA_RANGE));
  return values
    .map((row, index) => rowToNotarization(row, index + 2))
    .filter(isVisibleNotarization);
}

async function findNotarizationByReceiptNo(
  accessToken: string,
  receiptNo: string,
  options?: { includeDeleted?: boolean }
): Promise<NotarizationEntry | null> {
  const target = receiptNo.trim().toUpperCase();
  if (!target) return null;

  await ensureNotarizationSheetReady(accessToken);
  const sheetName = GL.sheets.notarization;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_DATA_RANGE));
  for (let index = 0; index < values.length; index++) {
    const entry = rowToNotarization(values[index], index + 2);
    if (!entry.receiptNo || entry.receiptNo.toUpperCase() !== target) continue;
    if (!options?.includeDeleted && entry.status === NOTARIZATION_DELETED_STATUS) continue;
    return entry;
  }
  return null;
}

export async function createNotarization(
  accessToken: string,
  payload: NotarizationPayload,
  recordedBy: string
): Promise<NotarizationEntry> {
  const name = payload.name?.trim();
  const documentType = payload.documentType?.trim();
  if (!name) throw new Error("Name is required.");
  if (!documentType) throw new Error("Document type is required.");

  const billingKind = payload.billingKind === "retainer" ? "retainer" : "charge";
  let amount = 0;
  let method = "";

  if (billingKind === "retainer") {
    amount = 0;
    method = "Retainer";
  } else {
    const billing = resolveNotarizationBilling(payload);
    amount = billing.amount;
    method = billing.method;
  }

  await ensureNotarizationSheetReady(accessToken);
  const sheetName = GL.sheets.notarization;
  const receiptNo = await nextNotarizationReceiptNo(accessToken);
  const date = payload.date?.trim() || todayYmd();
  const series = payload.series?.trim() || String(new Date(date).getFullYear() || new Date().getFullYear());

  const row = padRow([
    receiptNo,
    date,
    name,
    documentType,
    payload.docNo?.trim() || "",
    payload.pageNo?.trim() || "",
    payload.bookNo?.trim() || "",
    series,
    amount,
    method,
    payload.paymentDetails?.trim() || "",
    payload.clientCode?.trim().toUpperCase() || "",
    payload.notes?.trim() || "",
    recordedBy || "",
    "",
    "Recorded",
    payload.address?.trim() || "",
    ""
  ]);

  await appendSheetValues(accessToken, toA1Range(sheetName, NOTARIZATION_APPEND_RANGE), [row]);

  const entries = await listNotarizations(accessToken);
  const created = entries.find((e) => e.receiptNo.toUpperCase() === receiptNo.toUpperCase());
  if (!created) throw new Error("Notarization was saved but could not be reloaded.");
  return created;
}

function resolveNotarizationBilling(
  payload: Pick<NotarizationPayload | NotarizationUpdatePayload, "billingKind" | "amount" | "paymentMethod">
): { amount: number; method: string } {
  const billingKind = payload.billingKind === "retainer" ? "retainer" : "charge";
  if (billingKind === "retainer") {
    return { amount: 0, method: NOTARIZATION_RETAINER_METHOD };
  }

  const amount = parseMoney(payload.amount);
  if (!amount || amount <= 0) {
    throw new Error("Enter a valid amount, or choose Retainer (no charge).");
  }
  const method = payload.paymentMethod?.trim()
    ? normalizePaymentMethod(payload.paymentMethod) || payload.paymentMethod.trim()
    : "";
  return { amount, method };
}

export async function updateNotarization(
  accessToken: string,
  payload: NotarizationUpdatePayload
): Promise<NotarizationEntry> {
  const receiptNo = payload.receiptNo?.trim();
  if (!receiptNo) throw new Error("Receipt number is required.");

  const name = payload.name?.trim();
  const documentType = payload.documentType?.trim();
  if (!name) throw new Error("Name is required.");
  if (!documentType) throw new Error("Document type is required.");

  const entry = await findNotarizationByReceiptNo(accessToken, receiptNo);
  if (!entry) throw new Error(`Notarization not found: ${receiptNo}`);

  const { amount, method } = resolveNotarizationBilling(payload);
  const date = payload.date?.trim() || entry.date || todayYmd();
  const series = payload.series?.trim() || entry.series || String(new Date(date).getFullYear());

  await ensureNotarizationSheetReady(accessToken);
  const sheetName = GL.sheets.notarization;
  const row = padRow([
    entry.receiptNo,
    date,
    name,
    documentType,
    payload.docNo?.trim() || "",
    payload.pageNo?.trim() || "",
    payload.bookNo?.trim() || "",
    series,
    amount,
    method,
    payload.paymentDetails?.trim() || "",
    payload.clientCode?.trim().toUpperCase() || "",
    payload.notes?.trim() || "",
    entry.recordedBy,
    entry.pdfLink,
    entry.status || "Recorded",
    payload.address?.trim() || "",
    entry.receiptIssuedAt
  ]);

  await updateSheetValues(accessToken, toA1Range(sheetName, `A${entry.rowNumber}:R${entry.rowNumber}`), [row]);

  return {
    ...entry,
    date,
    name,
    documentType,
    docNo: payload.docNo?.trim() || "",
    pageNo: payload.pageNo?.trim() || "",
    bookNo: payload.bookNo?.trim() || "",
    series,
    amount,
    paymentMethod: method,
    paymentDetails: payload.paymentDetails?.trim() || "",
    clientCode: payload.clientCode?.trim().toUpperCase() || "",
    notes: payload.notes?.trim() || "",
    address: payload.address?.trim() || ""
  };
}

export async function setNotarizationReceiptLink(
  accessToken: string,
  rowNumber: number,
  pdfLink: string,
  issuedAt = todayYmd()
): Promise<void> {
  const sheetName = GL.sheets.notarization;
  await updateSheetValues(accessToken, toA1Range(sheetName, `O${rowNumber}:P${rowNumber}`), [
    [pdfLink, "Receipt Generated"]
  ]);
  await updateSheetValues(accessToken, toA1Range(sheetName, `R${rowNumber}`), [[issuedAt]]);
}

export async function issueNotarizationReceipt(
  accessToken: string,
  receiptNo: string
): Promise<NotarizationEntry> {
  const entry = await findNotarizationByReceiptNo(accessToken, receiptNo);
  if (!entry) throw new Error(`Notarization not found: ${receiptNo}`);
  if (entry.pdfLink.trim()) {
    const issuedLabel = formatNotarizationReceiptIssuedDate(entry.receiptIssuedAt);
    throw new Error(
      issuedLabel
        ? `An acknowledgment receipt was already issued on ${issuedLabel}.`
        : "An acknowledgment receipt was already issued for this notarization."
    );
  }

  const { pdfUrl } = await generateNotarialReceiptNative(
    accessToken,
    notarizationReceiptPayload(entry)
  );
  if (!pdfUrl) {
    throw new Error("Receipt was generated but no PDF link was returned.");
  }

  const issuedAt = todayYmd();
  await setNotarizationReceiptLink(accessToken, entry.rowNumber, pdfUrl, issuedAt);
  return {
    ...entry,
    pdfLink: pdfUrl,
    status: "Receipt Generated",
    receiptIssuedAt: issuedAt
  };
}

function restoredStatusForEntry(entry: NotarizationEntry): string {
  if (entry.pdfLink.trim()) return "Receipt Generated";
  if (entry.status && entry.status !== NOTARIZATION_DELETED_STATUS) return entry.status;
  return "Recorded";
}

export async function deleteNotarization(
  accessToken: string,
  receiptNo: string
): Promise<{ receiptNo: string; previousStatus: string; entry: NotarizationEntry }> {
  const entry = await findNotarizationByReceiptNo(accessToken, receiptNo);
  if (!entry) throw new Error(`Notarization not found: ${receiptNo}`);

  const previousStatus = entry.status || "Recorded";
  const sheetName = GL.sheets.notarization;
  await updateSheetValues(accessToken, toA1Range(sheetName, `P${entry.rowNumber}`), [
    [NOTARIZATION_DELETED_STATUS]
  ]);

  return { receiptNo: entry.receiptNo, previousStatus, entry };
}

export async function restoreNotarization(
  accessToken: string,
  receiptNo: string,
  previousStatus?: string
): Promise<NotarizationEntry> {
  const entry = await findNotarizationByReceiptNo(accessToken, receiptNo, { includeDeleted: true });
  if (!entry) throw new Error(`Notarization not found: ${receiptNo}`);
  if (entry.status !== NOTARIZATION_DELETED_STATUS) {
    throw new Error(`Notarization ${entry.receiptNo} is not deleted.`);
  }

  const sheetName = GL.sheets.notarization;
  const status =
    previousStatus && previousStatus !== NOTARIZATION_DELETED_STATUS
      ? previousStatus
      : restoredStatusForEntry(entry);
  await updateSheetValues(accessToken, toA1Range(sheetName, `P${entry.rowNumber}`), [[status]]);

  return { ...entry, status };
}
