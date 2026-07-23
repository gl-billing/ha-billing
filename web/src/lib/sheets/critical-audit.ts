import type { LedgerEditPayload, LedgerEntryPayload } from "@/lib/gl-config";

function compact(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" · ");
}

export function formatLedgerAddAudit(entry: LedgerEntryPayload): { summary: string; details: string } {
  const type = String(entry.type || "Entry").trim();
  const amount = entry.charge || entry.payment || "";
  const summary = `${type} added`;
  const details = compact([
    type,
    amount ? `₱${amount}` : "",
    entry.date || "",
    entry.category || "",
    entry.description || "",
    entry.method ? `via ${entry.method}` : "",
    entry.details ? `ref ${entry.details}` : ""
  ]);
  return { summary, details };
}

export function formatLedgerEditAudit(body: LedgerEditPayload): { summary: string; details: string } {
  const summary = `Row ${body.sheetRow} edited`;
  const details = compact([
    body.charge || body.payment || "",
    body.date || "",
    body.description || body.category || "",
    body.reclassifyIncome ? "income reclassified" : ""
  ]);
  return { summary, details };
}

export function formatLedgerRowAudit(
  action: "ledger.void" | "ledger.restore",
  clientCode: string,
  sheetRow: number,
  snapshot?: Record<string, unknown>
): { summary: string; details: string } {
  const summary = action === "ledger.void" ? `Row ${sheetRow} voided` : `Row ${sheetRow} restored after void`;
  const details = compact([
    clientCode,
    snapshot?.type ? String(snapshot.type) : "",
    snapshot?.charge != null ? String(snapshot.charge) : snapshot?.payment != null ? String(snapshot.payment) : "",
    snapshot?.description ? String(snapshot.description) : snapshot?.category ? String(snapshot.category) : ""
  ]);
  return { summary, details };
}

export function formatClientDeleteCompletedAudit(options: {
  clientCode: string;
  clientName?: string;
  force?: boolean;
  officeItemsRemoved?: number;
  workMattersRemoved?: number;
}): { summary: string; details: string } {
  const summary = `Client ${options.clientCode} permanently deleted`;
  const details = compact([
    options.clientName || "",
    options.force ? "forced delete" : "",
    options.officeItemsRemoved
      ? `removed ${options.officeItemsRemoved} related task(s)/hearing(s)`
      : "office tasks left unchanged",
    options.workMattersRemoved ? `removed ${options.workMattersRemoved} work matter row(s)` : ""
  ]);
  return { summary, details };
}

export function formatSheetsBackupAudit(message: string): { summary: string; details: string } {
  return {
    summary: "Nightly spreadsheet backup",
    details: message.trim()
  };
}
