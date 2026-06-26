import type { GenerateNotarialReceiptPayload } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { callAppsScriptWebApp, isAppsScriptConfigured } from "@/lib/apps-script";
import { notarizationReceiptPaymentFor } from "@/lib/notarization-utils";
import { getOrCreateNrFolderId } from "@/lib/sheets/drive-nr-folder";
import {
  deleteSheetById,
  getSheetIdByTitle
} from "@/lib/sheets/sheet-meta";
import { getSheetsClient, getSpreadsheetId, toA1Range } from "@/lib/sheets/client";
import { readSettingsMap } from "@/lib/sheets/settings";

const RECEIPT_TEMPLATE_SHEET = "Acknowledgment Receipt";
const RECEIPT_LAST_ROW = 25;
const RECEIPT_LAST_COL = 7;
const RECEIPT_ROW_PX_PER_INCH = 72;
const RECEIPT_COL_PX_PER_INCH = 96;
const RECEIPT_WIDTH_PAD_IN = 0.2;
const RECEIPT_HEIGHT_PAD_IN = 0.08;
const RECEIPT_SIZE_BUFFER = 1.06;
const RECEIPT_HEIGHT_SIZE_BUFFER = 1;
const RECEIPT_DEFAULT_WIDTH_MM = 127;

type ReceiptBounds = { lastRow: number; lastCol: number };

function mmToInches(mm: number): number {
  return Math.round((mm / 25.4) * 100) / 100;
}

function formatDateLong(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).trim().slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function amountToWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function under1000(num: number): string {
    let parts: string[] = [];
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    if (hundred) parts.push(`${ones[hundred]} Hundred`);
    if (rest) {
      if (rest < 20) parts.push(ones[rest]);
      else {
        const t = Math.floor(rest / 10);
        const o = rest % 10;
        parts.push(o ? `${tens[t]}-${ones[o]}` : tens[t]);
      }
    }
    return parts.join(" ");
  }

  const million = Math.floor(n / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const chunks: string[] = [];
  if (million) chunks.push(`${under1000(million)} Million`);
  if (thousand) chunks.push(`${under1000(thousand)} Thousand`);
  if (rest) chunks.push(under1000(rest));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function buildTagMap(
  payload: GenerateNotarialReceiptPayload,
  firmName: string
): Record<string, string> {
  const receiptDateStr = formatDateLong(new Date());
  const paymentDateStr = payload.date ? formatDateLong(payload.date) : receiptDateStr;
  const method = String(payload.paymentMethod || "");
  const methodLower = method.toLowerCase();
  const paymentFor = notarizationReceiptPaymentFor(payload.documentType);
  const amount = Number(payload.amount) || 0;

  return {
    "{{RECEIPT_NUMBER}}": String(payload.receiptNo || ""),
    "{{RECEIPT_DATE}}": receiptDateStr,
    "{{PAYMENT_DATE}}": paymentDateStr,
    "{{CLIENT_NAME}}": String(payload.name || ""),
    "{{CLIENT_ADDRESS}}": String(payload.address || ""),
    "{{CLIENT_PHONE}}": "",
    "{{CASE_TITLE}}": paymentFor,
    "{{CASE_NUMBER}}": "",
    "{{PAYMENT_FOR}}": paymentFor,
    "{{DOCUMENT_TYPE}}": String(payload.documentType || ""),
    "{{DOC_NUMBER}}": String(payload.docNo || ""),
    "{{PAGE_NUMBER}}": String(payload.pageNo || ""),
    "{{BOOK_NUMBER}}": String(payload.bookNo || ""),
    "{{SERIES}}": String(payload.series || ""),
    "{{AMOUNT_PAID}}": amount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "{{AMOUNT_PAID_WORDS}}": `${amountToWords(amount)} Pesos`,
    "{{BALANCE_AFTER_PAYMENT}}": formatPeso(0),
    "{{PAYMENT_METHOD}}": method,
    "{{PAYMENT_DETAILS}}": String(payload.paymentDetails || ""),
    "{{CASH_CHECK}}": methodLower.includes("cash") ? "✓" : " ",
    "{{TRANSFER_CHECK}}": /bank|transfer|gcash|maya|online|e-wallet|ewallet/.test(methodLower) ? "✓" : " ",
    "{{BANK_TRANSFER_CHECK}}": /bank|transfer|gcash|maya|online|e-wallet|ewallet/.test(methodLower) ? "✓" : " ",
    "{{CHECK_CHECK}}": /check|cheque/.test(methodLower) ? "✓" : " ",
    "{{RECEIVED_BY}}": firmName
  };
}

function replaceTagsInText(text: string, tags: Record<string, string>): string {
  let next = text;
  for (const [tag, value] of Object.entries(tags)) {
    if (next.includes(tag)) next = next.split(tag).join(value);
  }
  return next;
}

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
}

async function uploadPdfToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  pdf: Buffer
): Promise<string> {
  const boundary = `ha-billing-${Date.now()}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: "application/pdf"
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    pdf,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const uploadRes = await driveFetch(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  if (!uploadRes.ok) {
    const detail = (await uploadRes.text()).slice(0, 200);
    if (/insufficient|scope|permission|403/i.test(detail)) {
      throw new Error(
        "Google Drive permission is required to save receipt PDFs. Sign out and sign in again to grant Drive access, then retry."
      );
    }
    throw new Error(`Could not save receipt PDF to Drive (${uploadRes.status}).`);
  }

  const file = (await uploadRes.json()) as { id?: string; webViewLink?: string };
  if (file.webViewLink) return file.webViewLink;
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`;
  throw new Error("Receipt PDF was uploaded but no view link was returned.");
}

async function findReceiptLastContentRow(
  accessToken: string,
  sheetTitle: string,
  lastCol: number,
  scanThrough: number
): Promise<number> {
  const sheets = getSheetsClient(accessToken);
  const range = toA1Range(sheetTitle, `A1:${columnLetter(lastCol)}${scanThrough}`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueRenderOption: "FORMATTED_VALUE"
  });
  const values = (res.data.values as string[][]) || [];
  for (let r = values.length - 1; r >= 0; r--) {
    const row = values[r] || [];
    if (row.some((cell) => String(cell ?? "").trim() !== "")) {
      return r + 1;
    }
  }
  return 1;
}

function columnLetter(col: number): string {
  let letter = "";
  let n = col;
  while (n > 0) {
    const mod = (n - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    n = Math.floor((n - mod) / 26);
  }
  return letter;
}

async function getReceiptPageSizeInches(
  accessToken: string,
  sheetTitle: string,
  sheetId: number,
  bounds: ReceiptBounds
): Promise<string> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    ranges: [toA1Range(sheetTitle, `A1:${columnLetter(bounds.lastCol)}${bounds.lastRow}`)],
    includeGridData: true,
    fields:
      "sheets.data.rowData.values.effectiveValue,sheets.data.columnMetadata.pixelSize,sheets.data.rowMetadata.pixelSize"
  });

  const sheet = meta.data.sheets?.find((s) => s.properties?.sheetId === sheetId) || meta.data.sheets?.[0];
  const grid = sheet?.data?.[0];
  const colMeta = grid?.columnMetadata || [];
  const rowMeta = grid?.rowMetadata || [];

  let totalWidthPx = 0;
  let totalHeightPx = 0;
  for (let c = 0; c < bounds.lastCol; c++) {
    totalWidthPx += colMeta[c]?.pixelSize || 100;
  }
  for (let r = 0; r < bounds.lastRow; r++) {
    totalHeightPx += rowMeta[r]?.pixelSize || 21;
  }

  const widthIn = Math.max(
    mmToInches(RECEIPT_DEFAULT_WIDTH_MM),
    Math.round(((totalWidthPx / RECEIPT_COL_PX_PER_INCH) * RECEIPT_SIZE_BUFFER + RECEIPT_WIDTH_PAD_IN) * 100) /
      100
  );
  const heightIn = Math.max(
    1.5,
    Math.round(
      ((totalHeightPx / RECEIPT_ROW_PX_PER_INCH) * RECEIPT_HEIGHT_SIZE_BUFFER + RECEIPT_HEIGHT_PAD_IN) * 100
    ) / 100
  );

  return `${widthIn}x${heightIn}`;
}

async function exportReceiptPdf(
  accessToken: string,
  sheetId: number,
  pageSize: string,
  bounds: ReceiptBounds
): Promise<Buffer> {
  const url =
    `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/export?exportFormat=pdf&format=pdf` +
    `&gid=${sheetId}` +
    `&size=${encodeURIComponent(pageSize)}` +
    `&portrait=true&scale=1&fitw=false&fith=false&pageorder=1` +
    `&r1=0&c1=0&r2=${bounds.lastRow}&c2=${bounds.lastCol}` +
    `&top_margin=0.00&bottom_margin=0.00&left_margin=0.00&right_margin=0.00` +
    `&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&pagenumbers=false` +
    `&fzr=false&fzc=false&printnotes=false` +
    `&horizontal_alignment=LEFT&vertical_alignment=TOP`;

  const res = await driveFetch(accessToken, url);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Receipt PDF export failed (${res.status}): ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function trimTempSheet(
  accessToken: string,
  sheetId: number,
  bounds: ReceiptBounds
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties"
  });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.sheetId === sheetId);
  const maxRows = sheet?.properties?.gridProperties?.rowCount || bounds.lastRow;
  const maxCols = sheet?.properties?.gridProperties?.columnCount || bounds.lastCol;
  const requests = [];
  if (maxRows > bounds.lastRow) {
    requests.push({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: bounds.lastRow, endIndex: maxRows }
      }
    });
  }
  if (maxCols > bounds.lastCol) {
    requests.push({
      deleteDimension: {
        range: { sheetId, dimension: "COLUMNS", startIndex: bounds.lastCol, endIndex: maxCols }
      }
    });
  }
  if (!requests.length) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { requests }
  });
}

function isNrFolderResolutionError(message: string): boolean {
  return /NR folder|notarial receipts folder|Could not find a notarial receipts folder/i.test(message);
}

const NR_FOLDER_SETTINGS_HINT =
  "Open your billing spreadsheet Settings tab and add a row: key NR Folder ID, value your notarial receipts Drive folder ID (from the folder URL). Then retry Issue receipt.";

async function resolveNrFolderViaAppsScript(): Promise<string | null> {
  const result = await callAppsScriptWebApp("getNrFolderHeadless", {});
  const folderId = String(result.folderId || "").trim();
  return folderId || null;
}

async function generateNotarialReceiptNativeInternal(
  accessToken: string,
  payload: GenerateNotarialReceiptPayload,
  folderIdOverride?: string
): Promise<{ pdfUrl: string; receiptNumber: string }> {
  const templateId = await getSheetIdByTitle(accessToken, RECEIPT_TEMPLATE_SHEET);
  if (templateId === null) {
    throw new Error(`Could not find the ${RECEIPT_TEMPLATE_SHEET} tab.`);
  }

  const sheets = getSheetsClient(accessToken);
  const tempName = `TEMP_NR_${Date.now()}`;
  const dup = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId: templateId, newSheetName: tempName } }]
    }
  });
  const tempSheetId = dup.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;
  if (tempSheetId === undefined || tempSheetId === null) {
    throw new Error("Could not copy the acknowledgment receipt template.");
  }

  try {
    const settings = await readSettingsMap(accessToken);
    const firmName = settings.get("Firm Name")?.trim() || "HERNANDEZ & ASSOCIATES";
    const tags = buildTagMap(payload, firmName);
    const range = toA1Range(tempName, `A1:${columnLetter(RECEIPT_LAST_COL)}${RECEIPT_LAST_ROW}`);

    const [valuesRes, formulasRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: getSpreadsheetId(),
        range,
        valueRenderOption: "FORMATTED_VALUE"
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: getSpreadsheetId(),
        range,
        valueRenderOption: "FORMULA"
      })
    ]);

    const values = (valuesRes.data.values as string[][]) || [];
    const formulas = (formulasRes.data.values as string[][]) || [];
    const nextValues = values.map((row, r) =>
      (row || []).map((cell, c) => {
        const formula = formulas[r]?.[c];
        const source = typeof formula === "string" && formula.startsWith("=") ? formula : String(cell ?? "");
        return replaceTagsInText(source, tags);
      })
    );

    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: nextValues }
    });

    const lastRow = await findReceiptLastContentRow(
      accessToken,
      tempName,
      RECEIPT_LAST_COL,
      RECEIPT_LAST_ROW
    );
    const bounds: ReceiptBounds = { lastRow, lastCol: RECEIPT_LAST_COL };
    await trimTempSheet(accessToken, tempSheetId, bounds);
    const pageSize = await getReceiptPageSizeInches(accessToken, tempName, tempSheetId, bounds);
    const pdf = await exportReceiptPdf(accessToken, tempSheetId, pageSize, bounds);
    const folderId = folderIdOverride || (await getOrCreateNrFolderId(accessToken));
    const filename = `${payload.receiptNo}_Notarial_Acknowledgment_Receipt.pdf`;
    const pdfUrl = await uploadPdfToDrive(accessToken, folderId, filename, pdf);

    return { pdfUrl, receiptNumber: payload.receiptNo };
  } finally {
    await deleteSheetById(accessToken, tempSheetId).catch(() => null);
  }
}

/** Generate notarial receipt PDF via Sheets + Drive (no Apps Script receipt fallback). */
export async function generateNotarialReceiptNative(
  accessToken: string,
  payload: GenerateNotarialReceiptPayload
): Promise<{ pdfUrl: string; receiptNumber: string }> {
  try {
    return await generateNotarialReceiptNativeInternal(accessToken, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isNrFolderResolutionError(message) || !isAppsScriptConfigured()) {
      throw error;
    }

    try {
      const folderId = await resolveNrFolderViaAppsScript();
      if (folderId) {
        return await generateNotarialReceiptNativeInternal(accessToken, payload, folderId);
      }
    } catch (scriptError) {
      const scriptMessage = scriptError instanceof Error ? scriptError.message : String(scriptError);
      if (/Unknown action:\s*getNrFolderHeadless/i.test(scriptMessage)) {
        throw new Error(`${message} ${NR_FOLDER_SETTINGS_HINT}`);
      }
      throw scriptError;
    }

    throw new Error(`${message} ${NR_FOLDER_SETTINGS_HINT}`);
  }
}
