import type { DocumentLogEntry } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { getHyperlinksByRow, resolvePdfUrl } from "@/lib/sheets/hyperlinks";
import { getSheetValues, sheetExists } from "@/lib/sheets/client";

function formatTimestamp(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function rowToEntry(row: unknown[], logRow: number): DocumentLogEntry | null {
  if (!row[0] && !row[1]) return null;
  return {
    logRow,
    timestamp: formatTimestamp(row[0]),
    clientCode: String(row[1] || ""),
    clientName: String(row[2] || ""),
    documentType: String(row[3] || ""),
    documentNumber: String(row[4] || ""),
    amount: Number(row[5]) || 0,
    email: String(row[6] || ""),
    pdfUrl: String(row[7] || ""),
    status: String(row[8] || ""),
    user: String(row[9] || "")
  };
}

export async function getDocumentLog(
  accessToken: string,
  options?: { clientCode?: string; limit?: number }
): Promise<DocumentLogEntry[]> {
  if (!(await sheetExists(accessToken, GL.sheets.documentLog))) {
    return [];
  }

  const values = await getSheetValues(accessToken, `'${GL.sheets.documentLog}'!A2:J`);
  if (!values.length) return [];

  const startRow = 2;
  const endRow = startRow + values.length - 1;
  const hyperlinks = await getHyperlinksByRow(
    accessToken,
    `'${GL.sheets.documentLog}'!H${startRow}:H${endRow}`,
    startRow
  );

  const entries: DocumentLogEntry[] = [];
  values.forEach((row, index) => {
    const logRow = startRow + index;
    const entry = rowToEntry(row, logRow);
    if (!entry) return;
    if (options?.clientCode && entry.clientCode !== options.clientCode) return;
    entry.pdfUrl = resolvePdfUrl(entry.pdfUrl, hyperlinks.get(logRow));
    entries.push(entry);
  });

  entries.reverse();
  const limit = options?.limit ?? entries.length;
  return entries.slice(0, limit);
}
