import { GL, type AuditLogEntry } from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { ensureSheetTitle, sheetTitleExists } from "@/lib/sheets/sheet-meta";

const AUDIT_HEADERS = ["Timestamp", "User", "Action", "Client Code", "Summary", "Details"];

async function ensureAuditLogReady(accessToken: string, sheetName: string): Promise<void> {
  await ensureSheetTitle(accessToken, sheetName);

  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, "A1:F1"));
  const hasHeader = headerRow[0]?.[0] && String(headerRow[0][0]).trim();

  if (!hasHeader) {
    await updateSheetValues(accessToken, toA1Range(sheetName, "A1:F1"), [AUDIT_HEADERS]);
  }
}

export async function appendAuditLog(
  accessToken: string,
  entry: {
    user: string;
    action: string;
    clientCode?: string;
    summary: string;
    details?: string;
  }
): Promise<void> {
  const sheetName = GL.sheets.auditLog;
  await ensureAuditLogReady(accessToken, sheetName);

  const timestamp = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  await appendSheetValues(accessToken, toA1Range(sheetName, "A:F"), [
    [
      timestamp,
      entry.user || "system",
      entry.action,
      entry.clientCode || "",
      entry.summary,
      entry.details || ""
    ]
  ]);
}

export async function getAuditLog(
  accessToken: string,
  options?: { clientCode?: string; limit?: number }
): Promise<AuditLogEntry[]> {
  const sheetName = GL.sheets.auditLog;
  if (!(await sheetTitleExists(accessToken, sheetName))) return [];

  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:F"));
  let entries = values
    .filter((row) => row[0])
    .map((row, index) => ({
      logRow: index + 2,
      timestamp: String(row[0] || ""),
      user: String(row[1] || ""),
      action: String(row[2] || ""),
      clientCode: String(row[3] || ""),
      summary: String(row[4] || ""),
      details: String(row[5] || "")
    }));

  if (options?.clientCode) {
    const code = options.clientCode.trim();
    entries = entries.filter((e) => e.clientCode === code);
  }

  entries.sort((a, b) => b.logRow - a.logRow);

  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}
