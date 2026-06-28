import type { AuditLogEntry, DocumentLogEntry } from "@/lib/gl-config";
import { getAuditLog } from "@/lib/sheets/audit-log";
import { getDocumentLog } from "@/lib/sheets/document-log";

export type IncrementalBackupRow = {
  sortKey: number;
  timestamp: string;
  user: string;
  clientCode: string;
  source: "audit" | "document";
  category: string;
  summary: string;
  details: string;
  amount?: number;
};

export function parseLogTimestampMs(value: string): number {
  const ms = new Date(String(value || "").trim()).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function auditRow(entry: AuditLogEntry): IncrementalBackupRow {
  return {
    sortKey: parseLogTimestampMs(entry.timestamp) || entry.logRow,
    timestamp: entry.timestamp,
    user: entry.user,
    clientCode: entry.clientCode,
    source: "audit",
    category: entry.action,
    summary: entry.summary,
    details: entry.details || ""
  };
}

function documentRow(entry: DocumentLogEntry): IncrementalBackupRow {
  return {
    sortKey: parseLogTimestampMs(entry.timestamp) || entry.logRow,
    timestamp: entry.timestamp,
    user: entry.user,
    clientCode: entry.clientCode,
    source: "document",
    category: entry.documentType,
    summary: `${entry.documentNumber}${entry.clientName ? ` — ${entry.clientName}` : ""}`.trim(),
    details: entry.email ? `Sent to ${entry.email}` : entry.status || "",
    amount: entry.amount > 0 ? entry.amount : undefined
  };
}

export async function getIncrementalBackupRows(
  accessToken: string,
  sinceMs: number
): Promise<IncrementalBackupRow[]> {
  const [auditRows, documentRows] = await Promise.all([
    getAuditLog(accessToken, { limit: 5000 }),
    getDocumentLog(accessToken, { limit: 5000 })
  ]);

  const rows: IncrementalBackupRow[] = [
    ...auditRows.map(auditRow),
    ...documentRows.map(documentRow)
  ].filter((row) => row.sortKey > sinceMs);

  return rows.sort((a, b) => a.sortKey - b.sortKey || a.timestamp.localeCompare(b.timestamp));
}
