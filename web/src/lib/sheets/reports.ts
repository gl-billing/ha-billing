import type { ArAgingEntry, ArAgingReport, MonthlyCollectionsReport } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { getSheetsClient, getSpreadsheetId } from "@/lib/sheets/client";
import { getAllMasterRows } from "@/lib/sheets/master";
import { getSheetTitles } from "@/lib/sheets/sheet-meta";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function agingBucket(days: number): ArAgingEntry["bucket"] {
  if (days <= 30) return "current";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function getArAgingReport(accessToken: string): Promise<ArAgingReport> {
  const master = await getAllMasterRows(accessToken);
  const today = new Date();
  const entries: ArAgingEntry[] = [];

  master.forEach((row) => {
    if (!row[0]) return;
    const status = String(row[20] || "Active").toLowerCase();
    if (status === "closed") return;

    const balance = Number(row[11]) || 0;
    if (balance <= 0) return;

    const lastBilling = parseDate(row[7]) || parseDate(row[18]) || parseDate(row[17]);
    const daysPastDue = lastBilling ? Math.max(0, daysBetween(lastBilling, today)) : 0;

    entries.push({
      code: String(row[0]),
      name: String(row[1] || ""),
      caseTitle: String(row[2] || ""),
      balance,
      daysPastDue,
      bucket: agingBucket(daysPastDue),
      lastBillingDate: String(row[7] || row[18] || ""),
      accountStatus: String(row[15] || "")
    });
  });

  entries.sort((a, b) => b.balance - a.balance);

  const buckets = {
    current: entries.filter((e) => e.bucket === "current"),
    "31-60": entries.filter((e) => e.bucket === "31-60"),
    "61-90": entries.filter((e) => e.bucket === "61-90"),
    "90+": entries.filter((e) => e.bucket === "90+")
  };

  return {
    generatedAt: today.toISOString(),
    totalOutstanding: entries.reduce((sum, e) => sum + e.balance, 0),
    buckets
  };
}

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function ledgerFromRows(
  rows: string[][],
  client: { code: string; name: string },
  year: number,
  month: number
): { code: string; name: string; charges: number; payments: number } {
  let charges = 0;
  let payments = 0;

  rows.forEach((row) => {
    if (!row[0]) return;
    const type = String(row[1] || "").toLowerCase();
    if (type === "void") return;
    if (!isInMonth(String(row[0]), year, month)) return;
    if (type === "charge") charges += Number(row[4]) || 0;
    if (type === "payment") payments += Number(row[5]) || 0;
  });

  return { code: client.code, name: client.name, charges, payments };
}

/** Read many client ledgers in one API call (per chunk) instead of one call per client. */
async function batchGetClientLedgers(
  accessToken: string,
  clients: Array<{ code: string; name: string }>,
  existingTabs: Set<string>
): Promise<Map<string, string[][]>> {
  const sheets = getSheetsClient(accessToken);
  const result = new Map<string, string[][]>();
  const eligible = clients.filter((c) => existingTabs.has(c.code));
  const chunkSize = 40;

  for (let i = 0; i < eligible.length; i += chunkSize) {
    const chunk = eligible.slice(i, i + chunkSize);
    const ranges = chunk.map(
      (c) => `'${c.code.replace(/'/g, "''")}'!A${GL.ledgerStartRow}:F`
    );

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: getSpreadsheetId(),
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });

    const valueRanges = response.data.valueRanges || [];
    chunk.forEach((client, idx) => {
      result.set(client.code, (valueRanges[idx]?.values as string[][]) || []);
    });
  }

  return result;
}

export async function getMonthlyCollectionsReport(
  accessToken: string,
  year: number,
  month: number,
  master?: unknown[][]
): Promise<MonthlyCollectionsReport> {
  const [rows, tabTitles] = await Promise.all([
    master ? Promise.resolve(master) : getAllMasterRows(accessToken),
    getSheetTitles(accessToken)
  ]);

  const active = rows
    .filter((row) => row[0] && String(row[20] || "Active").toLowerCase() !== "closed")
    .map((row) => ({ code: String(row[0]), name: String(row[1] || "") }));

  const ledgers = await batchGetClientLedgers(accessToken, active, tabTitles);

  const byClient = active
    .map((client) =>
      ledgerFromRows(ledgers.get(client.code) || [], client, year, month)
    )
    .filter((r) => r.charges > 0 || r.payments > 0)
    .sort((a, b) => b.payments - a.payments);

  const totalCharges = byClient.reduce((s, c) => s + c.charges, 0);
  const totalPayments = byClient.reduce((s, c) => s + c.payments, 0);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    year,
    monthLabel,
    totalCharges,
    totalPayments,
    netCollected: totalPayments - totalCharges,
    chargeCount: byClient.filter((c) => c.charges > 0).length,
    paymentCount: byClient.filter((c) => c.payments > 0).length,
    byClient
  };
}
