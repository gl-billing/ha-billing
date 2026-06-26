import type { ActivityItem, ClientDetail, LedgerEntry } from "@/lib/gl-config";
import { getDocumentLog } from "@/lib/sheets/document-log";

function toSortKey(value: string): number {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export async function getClientActivity(
  accessToken: string,
  clientCode: string,
  detail: ClientDetail,
  ledgerEntries?: LedgerEntry[]
): Promise<ActivityItem[]> {
  const documents = await getDocumentLog(accessToken, { clientCode, limit: 50 });
  const entries = ledgerEntries ?? [];

  const items: ActivityItem[] = [];

  entries.forEach((entry) => {
    const type = entry.type.toLowerCase();
    if (type === "charge" && entry.charge > 0) {
      items.push({
        id: `charge-${entry.sheetRow}`,
        date: entry.date,
        sortKey: toSortKey(entry.date),
        kind: "charge",
        title: entry.description || entry.category || "Charge",
        subtitle: entry.category || "Charge",
        amount: entry.charge
      });
    }
    if (type === "payment" && entry.payment > 0) {
      items.push({
        id: `payment-${entry.sheetRow}`,
        date: entry.date,
        sortKey: toSortKey(entry.date),
        kind: "payment",
        title: entry.description || "Payment received",
        subtitle: [entry.method, entry.details].filter(Boolean).join(" · ") || "Payment",
        amount: entry.payment,
        pdfUrl: entry.pdfLink || undefined,
        status: entry.arSent ? "AR issued" : "No AR yet"
      });
    }
  });

  documents.forEach((doc) => {
    const kind = doc.documentType.toUpperCase() === "AR" ? "ar" : "soa";
    items.push({
      id: `doc-${doc.logRow}`,
      date: doc.timestamp,
      sortKey: toSortKey(doc.timestamp),
      kind,
      title: `${doc.documentType} ${doc.documentNumber}`,
      subtitle: `${doc.status}${doc.email ? ` · ${doc.email}` : ""}`,
      amount: doc.amount,
      pdfUrl: doc.pdfUrl || undefined,
      status: doc.status
    });
  });

  if (detail.soaSent) {
    items.push({
      id: "soa-master",
      date: detail.soaSent,
      sortKey: toSortKey(detail.soaSent),
      kind: "soa",
      title: `Last SOA${detail.lastInvoiceNumber ? `: ${detail.lastInvoiceNumber}` : ""}`,
      subtitle: "From Master List",
      pdfUrl: detail.lastInvoiceUrl || undefined
    });
  }

  if (detail.lastBillingDate) {
    items.push({
      id: "billing-date",
      date: detail.lastBillingDate,
      sortKey: toSortKey(detail.lastBillingDate),
      kind: "billing",
      title: "Last billing date",
      subtitle: detail.accountStatus || "Billing update"
    });
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.sortKey - a.sortKey);
}
