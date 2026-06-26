import type { PendingArEntry } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { getSheetValues } from "@/lib/sheets/client";
import { sheetTitleExists } from "@/lib/sheets/sheet-meta";
import { getClientPayments } from "@/lib/sheets/ledger-read";

function formatDateDisplay(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function rowFromPendingSheet(row: unknown[]): PendingArEntry {
  return {
    clientCode: String(row[0] || ""),
    clientName: String(row[1] || ""),
    date: formatDateDisplay(row[2]),
    amount: Number(row[3]) || 0,
    description: String(row[4] || ""),
    method: String(row[5] || ""),
    details: String(row[6] || ""),
    sheetRow: Number(row[7]) || 0,
    receiptNumber: String(row[8] || ""),
    status: String(row[9] || "Needs AR")
  };
}

async function readPendingArSheet(accessToken: string): Promise<PendingArEntry[] | null> {
  const sheetName = "Pending AR";
  if (!(await sheetTitleExists(accessToken, sheetName))) return null;

  const values = await getSheetValues(accessToken, `'${sheetName}'!A2:J`);
  if (!values.length) return [];

  return values
    .filter((row) => row[0])
    .map(rowFromPendingSheet)
    .filter((e) => e.amount > 0);
}

async function scanClientsForPendingAr(
  accessToken: string,
  master: unknown[][]
): Promise<PendingArEntry[]> {
  const candidates = master.filter(
    (row) =>
      row[0] &&
      String(row[20] || "Active").toLowerCase() !== "closed" &&
      String(row[16] || "").toLowerCase() === "yes"
  );

  const entries: PendingArEntry[] = [];
  const batchSize = 3;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (row) => {
        const code = String(row[0]).trim();
        const name = String(row[1] || "");
        try {
          const payments = await getClientPayments(accessToken, code, true);
          payments.forEach((p) => {
            entries.push({
              clientCode: code,
              clientName: name,
              date: p.date,
              amount: p.amount,
              description: p.description,
              method: p.method,
              details: p.details,
              sheetRow: p.sheetRow,
              receiptNumber: p.receiptNumber,
              status: "Needs AR"
            });
          });
        } catch {
          /* skip missing tabs */
        }
      })
    );
  }

  return entries;
}

/** Prefer the spreadsheet Pending AR tab (1 read). Fall back to AR-flagged clients only. */
export async function getPendingArEntries(
  accessToken: string,
  master?: unknown[][]
): Promise<PendingArEntry[]> {
  const fromSheet = await readPendingArSheet(accessToken);
  if (fromSheet !== null) {
    return fromSheet.sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    });
  }

  const rows = master ?? (await getSheetValues(accessToken, `'${GL.sheets.master}'!A2:Z`));
  const entries = await scanClientsForPendingAr(accessToken, rows);
  return entries.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });
}
