import type { AuditLogEntry, DocumentLogEntry } from "@/lib/gl-config";
import { getAuditLog } from "@/lib/sheets/audit-log";
import { getDocumentLog } from "@/lib/sheets/document-log";

export type BillingHistoryKind =
  | "charge"
  | "payment"
  | "void"
  | "edit"
  | "soa"
  | "ar"
  | "client"
  | "other";

export type BillingHistoryFilter = "all" | "ledger" | "documents" | "clients";

export type BillingHistoryItem = {
  id: string;
  sortKey: number;
  logRow: number;
  timestamp: string;
  user: string;
  clientCode: string;
  clientName?: string;
  kind: BillingHistoryKind;
  title: string;
  subtitle?: string;
  amount?: number;
  pdfUrl?: string;
  status?: string;
};

function parseSortKey(timestamp: string, logRow: number): number {
  const t = new Date(timestamp).getTime();
  return Number.isNaN(t) ? logRow : t;
}

function auditKind(entry: AuditLogEntry): BillingHistoryKind {
  const action = entry.action.toLowerCase();
  const summary = entry.summary.toLowerCase();

  if (action === "ledger.add") {
    if (summary.includes("payment")) return "payment";
    if (summary.includes("charge")) return "charge";
    return "other";
  }
  if (action === "ledger.void") return "void";
  if (action === "ledger.edit") return "edit";
  if (action.startsWith("client.")) return "client";
  return "other";
}

function auditTitle(entry: AuditLogEntry, kind: BillingHistoryKind): string {
  if (kind === "charge") return "Charge added";
  if (kind === "payment") return "Payment recorded";
  if (kind === "void") return "Entry voided";
  if (kind === "edit") return "Ledger entry edited";
  if (kind === "client") {
    if (entry.action.toLowerCase() === "client.delete") return "Client deleted";
    return entry.summary || "Client updated";
  }
  return entry.summary || entry.action;
}

function documentKind(entry: DocumentLogEntry): BillingHistoryKind {
  const type = entry.documentType.toUpperCase();
  if (type.includes("AR") || type.includes("RECEIPT")) return "ar";
  if (type.includes("SOA") || type.includes("STATEMENT")) return "soa";
  return "other";
}

function parseAmountFromDetails(details: string): number | undefined {
  if (!details.trim()) return undefined;
  const tail = details.split("·").pop()?.trim().replace(/,/g, "") || "";
  const n = Number(tail);
  return n > 0 ? n : undefined;
}

function fromAudit(entry: AuditLogEntry): BillingHistoryItem {
  const kind = auditKind(entry);
  return {
    id: `audit-${entry.logRow}`,
    sortKey: parseSortKey(entry.timestamp, entry.logRow),
    logRow: entry.logRow,
    timestamp: entry.timestamp,
    user: entry.user,
    clientCode: entry.clientCode,
    kind,
    title: auditTitle(entry, kind),
    subtitle: entry.details || undefined,
    amount: parseAmountFromDetails(entry.details)
  };
}

function fromDocument(entry: DocumentLogEntry): BillingHistoryItem {
  const kind = documentKind(entry);
  const typeLabel = kind === "ar" ? "Receipt" : "SOA";
  return {
    id: `doc-${entry.logRow}`,
    sortKey: parseSortKey(entry.timestamp, entry.logRow),
    logRow: entry.logRow,
    timestamp: entry.timestamp,
    user: entry.user,
    clientCode: entry.clientCode,
    clientName: entry.clientName || undefined,
    kind,
    title: `${typeLabel} ${entry.documentNumber}`.trim(),
    subtitle: entry.email ? `Sent to ${entry.email}` : undefined,
    amount: entry.amount > 0 ? entry.amount : undefined,
    pdfUrl: entry.pdfUrl || undefined,
    status: entry.status || undefined
  };
}

function matchesFilter(kind: BillingHistoryKind, filter: BillingHistoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ledger") return kind === "charge" || kind === "payment" || kind === "void" || kind === "edit";
  if (filter === "documents") return kind === "soa" || kind === "ar";
  if (filter === "clients") return kind === "client";
  return true;
}

export async function getFirmBillingHistory(
  accessToken: string,
  options?: { limit?: number; filter?: BillingHistoryFilter }
): Promise<BillingHistoryItem[]> {
  const limit = options?.limit ?? 100;
  const filter = options?.filter ?? "all";

  const [auditRows, documentRows] = await Promise.all([
    getAuditLog(accessToken, { limit: 500 }),
    getDocumentLog(accessToken, { limit: 500 })
  ]);

  const items: BillingHistoryItem[] = [
    ...auditRows.map(fromAudit),
    ...documentRows.map(fromDocument)
  ]
    .filter((item) => matchesFilter(item.kind, filter))
    .sort((a, b) => b.sortKey - a.sortKey || b.logRow - a.logRow);

  return items.slice(0, limit);
}
