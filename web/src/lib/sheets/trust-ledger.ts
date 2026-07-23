import { GL, type TrustLedgerEntry, type TrustLedgerEntryType, type TrustLedgerSummary } from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { ensureSheetTitle, sheetTitleExists } from "@/lib/sheets/sheet-meta";

const TRUST_HEADERS = [
  "Date",
  "Client Code",
  "Client Name",
  "Type",
  "Amount",
  "Balance",
  "Description",
  "Recorded By"
] as const;

function normalizeType(value: string): TrustLedgerEntryType {
  const text = value.trim().toLowerCase();
  if (text.startsWith("disb")) return "Disbursement";
  if (text.startsWith("trans")) return "Transfer";
  return "Deposit";
}

async function ensureTrustLogReady(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.trustLog;
  await ensureSheetTitle(accessToken, sheetName);
  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, "A1:H1"));
  if (!headerRow[0]?.[0]) {
    await updateSheetValues(accessToken, toA1Range(sheetName, "A1:H1"), [TRUST_HEADERS.slice()]);
  }
}

function mapRow(row: string[], sheetRow: number): TrustLedgerEntry | null {
  if (!row[0]) return null;
  return {
    sheetRow,
    date: String(row[0] || ""),
    clientCode: String(row[1] || "").trim().toUpperCase(),
    clientName: String(row[2] || ""),
    type: normalizeType(String(row[3] || "Deposit")),
    amount: Number(row[4]) || 0,
    balance: Number(row[5]) || 0,
    description: String(row[6] || ""),
    recordedBy: String(row[7] || "")
  };
}

export async function getTrustLedger(
  accessToken: string,
  options?: { clientCode?: string; limit?: number }
): Promise<{ entries: TrustLedgerEntry[]; summary: TrustLedgerSummary }> {
  const sheetName = GL.sheets.trustLog;
  if (!(await sheetTitleExists(accessToken, sheetName))) {
    return { entries: [], summary: { totalHeld: 0, entryCount: 0, clientCount: 0 } };
  }

  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:H"));
  let entries = values
    .map((row, index) => mapRow(row, index + 2))
    .filter((entry): entry is TrustLedgerEntry => Boolean(entry));

  if (options?.clientCode) {
    const code = options.clientCode.trim().toUpperCase();
    entries = entries.filter((entry) => entry.clientCode === code);
  }

  entries.sort((a, b) => b.sheetRow - a.sheetRow);
  const limit = options?.limit ?? 100;
  entries = entries.slice(0, limit);

  const lastBalances = new Map<string, number>();
  for (const entry of [...entries].reverse()) {
    lastBalances.set(entry.clientCode, entry.balance);
  }
  const totalHeld = [...lastBalances.values()].reduce((sum, value) => sum + value, 0);

  return {
    entries,
    summary: {
      totalHeld: Math.round(totalHeld * 100) / 100,
      entryCount: entries.length,
      clientCount: lastBalances.size
    }
  };
}

export async function addTrustLedgerEntry(
  accessToken: string,
  input: {
    clientCode: string;
    clientName: string;
    type: TrustLedgerEntryType;
    amount: number;
    description?: string;
    recordedBy: string;
    date?: string;
  }
): Promise<TrustLedgerEntry> {
  await ensureTrustLogReady(accessToken);
  const sheetName = GL.sheets.trustLog;
  const existing = await getTrustLedger(accessToken, { clientCode: input.clientCode, limit: 500 });
  const priorBalance = existing.entries[0]?.balance ?? 0;
  const signed =
    input.type === "Disbursement" ? -Math.abs(input.amount) : Math.abs(input.amount);
  const balance = Math.round((priorBalance + signed) * 100) / 100;
  const date =
    input.date?.trim() ||
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  await appendSheetValues(accessToken, toA1Range(sheetName, "A:H"), [
    [
      date,
      input.clientCode.trim().toUpperCase(),
      input.clientName,
      input.type,
      Math.abs(input.amount),
      balance,
      input.description || "",
      input.recordedBy
    ]
  ]);

  const refreshed = await getTrustLedger(accessToken, { clientCode: input.clientCode, limit: 1 });
  const entry = refreshed.entries[0];
  if (!entry) throw new Error("Could not read trust entry after save.");
  return entry;
}
