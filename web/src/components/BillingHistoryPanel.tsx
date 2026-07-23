"use client";

import { useCallback, useEffect, useState } from "react";
import type { BillingHistoryFilter, BillingHistoryItem } from "@/lib/sheets/billing-history";
import { formatPeso } from "@/lib/gl-config";
import { truncateForDisplay } from "@/lib/link-display";
import { billingHistoryModificationNote } from "@/lib/history-modification-note";

type Props = {
  busy?: boolean;
  onOpenClient?: (clientCode: string) => void;
};

const FILTERS: { id: BillingHistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ledger", label: "Charges & payments" },
  { id: "documents", label: "SOA & receipts" },
  { id: "clients", label: "Client updates" }
];

const kindLabels: Record<BillingHistoryItem["kind"], string> = {
  charge: "Charge",
  payment: "Payment",
  void: "Void",
  edit: "Edit",
  soa: "SOA",
  ar: "Receipt",
  client: "Client",
  other: "Billing"
};

const kindColors: Record<BillingHistoryItem["kind"], string> = {
  charge: "text-[#8b1e1e]",
  payment: "text-[#1f6b3a]",
  void: "text-muted",
  edit: "text-muted",
  soa: "text-gold-dark",
  ar: "text-gold-dark",
  client: "text-ink",
  other: "text-muted"
};

export function BillingHistoryPanel({ busy, onOpenClient }: Props) {
  const [filter, setFilter] = useState<BillingHistoryFilter>("all");
  const [items, setItems] = useState<BillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextFilter: BillingHistoryFilter) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/billing/history?limit=120&filter=${nextFilter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load history.");
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label mb-0">Office-wide log</p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={loading || busy}
          onClick={() => void load(filter)}
        >
          Update
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            className={`rounded px-2.5 py-1 text-[11px] font-bold ${
              filter === id
                ? "bg-[#171411] text-white"
                : "border border-line text-ink hover:bg-[#f5f3ef]"
            }`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted">Loading history…</p> : null}
      {error ? <p className="text-sm text-[#8b1e1e]">{error}</p> : null}

      {!loading && !error && !items.length ? (
        <p className="text-sm text-muted">
          No entries yet for this filter. Charges and payments appear when saved in Billing; SOA and receipts
          appear when generated from SOA / AR.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="relative space-y-0 pl-4">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
          {items.map((item) => {
            const modificationNote = billingHistoryModificationNote(item);
            return (
            <article key={item.id} className="relative pb-4 last:pb-0">
              <div className="absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 border-ink bg-white" />
              <div
                className={`history-entry rounded-lg border border-line/60 bg-[#faf9f7] p-2.5 ${
                  modificationNote ? "history-entry--noted" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      {kindLabels[item.kind]}
                    </p>
                    <p className="text-sm font-bold text-ink">{item.title}</p>
                    <p className="text-[11px] text-muted">
                      {item.timestamp}
                      {item.user ? ` · ${item.user}` : ""}
                    </p>
                  </div>
                  {item.amount !== undefined && item.amount > 0 ? (
                    <p className={`shrink-0 font-extrabold ${kindColors[item.kind]}`}>
                      {formatPeso(item.amount)}
                    </p>
                  ) : null}
                </div>

                {(item.clientCode || item.clientName) && (
                  <p className="mt-1 text-xs text-muted">
                    {item.clientCode ? (
                      onOpenClient ? (
                        <button
                          type="button"
                          className="font-bold text-gold-dark underline decoration-gold/40 underline-offset-2 hover:text-gold"
                          onClick={() => onOpenClient(item.clientCode)}
                        >
                          {item.clientCode}
                        </button>
                      ) : (
                        <span className="font-bold text-ink">{item.clientCode}</span>
                      )
                    ) : null}
                    {item.clientName ? ` · ${item.clientName}` : null}
                  </p>
                )}

                {item.subtitle ? (
                  <p className="audit-log-entry__line mt-1 text-xs text-ink/80" title={item.subtitle}>
                    {truncateForDisplay(item.subtitle, 48)}
                  </p>
                ) : null}
                {item.status ? (
                  <p className="mt-1 text-[11px] font-bold text-muted">{item.status}</p>
                ) : null}

                {item.pdfUrl ? (
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold mt-2 inline-block"
                  >
                    View PDF
                  </a>
                ) : null}
                {modificationNote ? <span className="history-entry__note">{modificationNote}</span> : null}
              </div>
            </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
