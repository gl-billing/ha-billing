import type { ClientLedgerSummary, LedgerEntry } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { getHyperlinksByRow, resolvePdfUrl } from "@/lib/sheets/hyperlinks";
import { getSheetValues, sheetExists } from "@/lib/sheets/client";

export type LedgerPaymentOption = {
  sheetRow: number;
  date: string;
  amount: number;
  balance: number;
  category: string;
  description: string;
  method: string;
  details: string;
  receiptNumber: string;
  arSent: boolean;
  display: string;
};

export type AppearanceFeeOption = {
  sheetRow: number;
  date: string;
  amount: number;
  category: string;
  description: string;
  display: string;
};

function formatPeso(value: number): string {
  return `₱${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateDisplay(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function getClientPayments(
  accessToken: string,
  clientCode: string,
  onlyWithoutAr = false
): Promise<LedgerPaymentOption[]> {
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error(`Client tab not found: ${clientCode}`);
  }

  const ledger = await getSheetValues(accessToken, `'${clientCode}'!A${GL.ledgerStartRow}:L`);
  const options: LedgerPaymentOption[] = [];

  ledger.forEach((row, index) => {
    const isPayment = String(row[1] || "").toLowerCase() === "payment";
    const amount = Number(row[5]) || 0;
    if (!row[0] || !isPayment || amount <= 0) return;

    const arSent = !!row[10];
    if (onlyWithoutAr && arSent) return;

    const description = String(row[3] || row[2] || "Payment");
    options.push({
      sheetRow: index + GL.ledgerStartRow,
      date: formatDateDisplay(row[0]),
      amount,
      balance: Number(row[6]) || 0,
      category: String(row[2] || ""),
      description,
      method: String(row[7] || ""),
      details: String(row[8] || ""),
      receiptNumber: String(row[9] || ""),
      arSent,
      display: `${formatDateDisplay(row[0])} | ${formatPeso(amount)} | ${description} | ${arSent ? "AR ISSUED" : "NO AR"}`
    });
  });

  return options;
}

export async function getAppearanceFees(
  accessToken: string,
  clientCode: string
): Promise<AppearanceFeeOption[]> {
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error(`Client tab not found: ${clientCode}`);
  }

  const ledger = await getSheetValues(accessToken, `'${clientCode}'!A${GL.ledgerStartRow}:L`);
  const options: AppearanceFeeOption[] = [];

  ledger.forEach((row, index) => {
    const type = String(row[1] || "").toLowerCase();
    const charge = Number(row[4]) || 0;
    const category = String(row[2] || "");
    const description = String(row[3] || "");
    const isAppearance = `${category} ${description}`.toLowerCase().includes("appearance fee");

    if (!row[0] || type !== "charge" || charge <= 0 || !isAppearance) return;

    options.push({
      sheetRow: index + GL.ledgerStartRow,
      date: formatDateDisplay(row[0]),
      amount: charge,
      category,
      description,
      display: `${formatDateDisplay(row[0])} | ${formatPeso(charge)} | ${description || category || "Appearance Fee"}`
    });
  });

  return options;
}

function rowToLedgerEntry(row: unknown[], sheetRow: number): LedgerEntry | null {
  if (!row[0]) return null;

  const type = String(row[1] || "").trim();
  const charge = Number(row[4]) || 0;
  const payment = Number(row[5]) || 0;
  if (!type && charge <= 0 && payment <= 0) return null;

  return {
    sheetRow,
    date: formatDateDisplay(row[0]),
    type: type || (charge > 0 ? "Charge" : payment > 0 ? "Payment" : ""),
    category: String(row[2] || ""),
    description: String(row[3] || ""),
    charge,
    payment,
    balance: Number(row[6]) || 0,
    method: String(row[7] || ""),
    details: String(row[8] || ""),
    documentNumber: String(row[9] || ""),
    arSent: !!row[10],
    pdfLink: String(row[11] || "")
  };
}

export async function getClientTabSummary(
  accessToken: string,
  clientCode: string
): Promise<{ totalDue: number; payments: number; charges: number } | null> {
  if (!(await sheetExists(accessToken, clientCode))) return null;

  const values = await getSheetValues(accessToken, `'${clientCode}'!E1:E3`);
  const row = values[0] || [];
  return {
    totalDue: Number(row[0]) || 0,
    payments: Number(row[1]) || 0,
    charges: Number(row[2]) || 0
  };
}

export async function getClientLedger(
  accessToken: string,
  clientCode: string
): Promise<{ entries: LedgerEntry[]; summary: ClientLedgerSummary }> {
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error(`Client tab not found: ${clientCode}`);
  }

  const ledger = await getSheetValues(accessToken, `'${clientCode}'!A${GL.ledgerStartRow}:L`);
  const entries: LedgerEntry[] = [];

  ledger.forEach((row, index) => {
    const entry = rowToLedgerEntry(row, index + GL.ledgerStartRow);
    if (entry) entries.push(entry);
  });

  if (ledger.length > 0) {
    const startRow = GL.ledgerStartRow;
    const endRow = startRow + ledger.length - 1;
    const hyperlinks = await getHyperlinksByRow(
      accessToken,
      `'${clientCode}'!L${startRow}:L${endRow}`,
      startRow
    );
    entries.forEach((entry) => {
      entry.pdfLink = resolvePdfUrl(entry.pdfLink, hyperlinks.get(entry.sheetRow));
    });
  }

  const tabSummary = await getClientTabSummary(accessToken, clientCode);
  let chargeCount = 0;
  let paymentCount = 0;
  let chargeTotal = 0;
  let paymentTotal = 0;

  entries.forEach((entry) => {
    const type = entry.type.toLowerCase();
    if (type === "charge" && entry.charge > 0) {
      chargeCount += 1;
      chargeTotal += entry.charge;
    }
    if (type === "payment" && entry.payment > 0) {
      paymentCount += 1;
      paymentTotal += entry.payment;
    }
  });

  const lastBalance = entries.length ? entries[entries.length - 1].balance : 0;

  return {
    entries,
    summary: {
      totalDue: tabSummary?.totalDue ?? lastBalance,
      payments: tabSummary?.payments ?? paymentTotal,
      charges: tabSummary?.charges ?? chargeTotal,
      entryCount: entries.length,
      chargeCount,
      paymentCount
    }
  };
}
