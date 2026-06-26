"use client";

import { AmountDisplay } from "@/components/AmountDisplay";
import { BillingOpsQueuePanel } from "@/components/BillingOpsQueuePanel";
import { ClientCodeButton } from "@/components/ClientCodeButton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { SmartLoadEmptyState } from "@/components/SmartLoadEmptyState";
import { DashboardSkeleton } from "@/components/Skeleton";
import { useCallback, useEffect, useState } from "react";
import type { HomeDashboard } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { cachedFetchJson, invalidateCachedFetch } from "@/lib/client-fetch-cache";

export type HomeNavigate = {
  page: "billing" | "clients" | "documents" | "walkIns" | "notarizations";
  clientCode?: string;
  docTab?: "soa" | "ar";
  billingTab?: "charge" | "payment";
};

type Props = {
  busy: boolean;
  onNavigate: (nav: HomeNavigate) => void;
  onRefresh: () => Promise<void>;
  onNotify?: (message: string, isError?: boolean) => void;
};

export function HomeDashboard({ busy, onNavigate, onRefresh, onNotify }: Props) {
  const [data, setData] = useState<HomeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [section, setSection] = useState<"ops" | "overview" | "pending" | "documents" | "batch">("ops");
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    if (fresh) invalidateCachedFetch("billing-home-dashboard");
    setLoading(true);
    setLoadError("");
    try {
      const { data: json, fetchedAt } = await cachedFetchJson("billing-home-dashboard", async () => {
        const res = await fetch("/api/home");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load dashboard.");
        return body as HomeDashboard;
      });
      setData(json);
      setLastSyncedAt(fetchedAt);
    } catch (error) {
      setData(null);
      setLoadError(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBatchSoa(deliveryAction: "Send Now" | "Create Gmail Draft") {
    if (!selectedBatch.size) {
      onNotify?.("Select at least one client.", true);
      return;
    }
    setBatchBusy(true);
    onNotify?.(`Sending SOA to ${selectedBatch.size} client(s)...`);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batchGenerateSOAHeadless",
          clientCodes: Array.from(selectedBatch),
          deliveryAction
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Batch SOA failed.");
      onNotify?.(json.message || "Batch SOA completed.");
      setSelectedBatch(new Set());
      await load();
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "Batch SOA failed.", true);
    } finally {
      setBatchBusy(false);
    }
  }

  function toggleBatch(code: string) {
    setSelectedBatch((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <SmartLoadEmptyState
        errorMessage={loadError || "Could not load firm dashboard."}
        context="dashboard"
        onRetry={() => void load(true)}
      />
    );
  }

  return (
    <div className="space-y-3 page-stagger">
      <section className="card page-stagger__item">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="section-label !mb-0">Firm overview</p>
            {lastSyncedAt ? (
              <p className="dashboard-sync-hint">
                Updated {new Date(lastSyncedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                {loading ? " · Refreshing…" : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-gold"
            disabled={busy}
            onClick={() => void load(true).then(() => onRefresh())}
          >
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Collectibles" value={formatPeso(data.totalCollectibles)} highlight />
          <Metric label="With balance" value={String(data.clientsWithBalance)} />
          <Metric label="Overdue" value={String(data.overdueClients)} alert={data.overdueClients > 0} />
          <Metric label="Pending AR" value={String(data.pendingArCount)} alert={data.pendingArCount > 0} />
        </div>
      </section>

      <nav className="nav-tabs-scroll home-dashboard-tabs" role="tablist" aria-label="Firm dashboard sections">
        {(
          [
            ["ops", "Ops queue"],
            ["overview", "Firm numbers"],
            ["pending", "Pending AR"],
            ["batch", "Batch SOA"],
            ["documents", "Document log"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={`nav-tab ${section === id ? "active" : ""}`}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "ops" ? <BillingOpsQueuePanel busy={busy} onNavigate={onNavigate} /> : null}

      {section === "overview" && (
        <>
          {data.topBalances.length > 0 && (
            <section className="card">
              <p className="section-label">Top balances</p>
              {data.topBalances.slice(0, 8).map((c) => (
                <ClientRow
                  key={c.code}
                  code={c.code}
                  name={c.name}
                  meta={`${formatPeso(c.totalDue)} · ${c.status}`}
                  onProfile={() => onNavigate({ page: "clients", clientCode: c.code })}
                  onBilling={() => onNavigate({ page: "billing", clientCode: c.code })}
                />
              ))}
            </section>
          )}

          {!data.topBalances.length && (
            <div className="card">
              <EmptyState
                title="All caught up"
                message="No active balances on the Master List right now."
              />
            </div>
          )}
        </>
      )}

      {section === "batch" && data && (
        <section className="card">
          <p className="section-label">Batch send SOA</p>
          <p className="mb-3 text-xs text-muted">
            Select clients with outstanding balances. Each SOA is generated and emailed individually.
          </p>
          {!data.overdueList.length && !data.topBalances.length ? (
            <EmptyState message="No clients with balances to bill — everyone is current." />
          ) : (
            <>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {[...data.overdueList, ...data.topBalances.filter((c) => !data.overdueList.some((o) => o.code === c.code))]
                  .slice(0, 20)
                  .map((c) => (
                    <label
                      key={c.code}
                      className="flex cursor-pointer items-center gap-2 rounded border border-line/60 bg-[#faf9f7] px-2 py-1.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatch.has(c.code)}
                        disabled={batchBusy || busy}
                        onChange={() => toggleBatch(c.code)}
                      />
                      <span className="flex-1">
                        <strong>{c.code}</strong> — {c.name} · {formatPeso(c.totalDue)}
                      </span>
                    </label>
                  ))}
              </div>
              <div className="form-grid-pair mt-3">
                <button
                  type="button"
                  className="btn-gold"
                  disabled={batchBusy || busy || !selectedBatch.size}
                  onClick={() => void runBatchSoa("Send Now")}
                >
                  Send SOA now
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={batchBusy || busy || !selectedBatch.size}
                  onClick={() => void runBatchSoa("Create Gmail Draft")}
                >
                  Create drafts
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {section === "pending" && (
        <section className="card">
          <p className="section-label">Pending acknowledgment receipts</p>
          {!data.pendingAr.length ? (
            <EmptyState message="No payments waiting for acknowledgment receipts." />
          ) : (
            <div className="space-y-2">
              {data.pendingAr.map((p) => (
                <article
                  key={`${p.clientCode}-${p.sheetRow}`}
                  className="rounded-lg border border-line/70 bg-[#faf9f7] p-2.5 text-sm"
                >
                  <p className="font-bold text-ink">
                    {p.clientCode} — {p.clientName}
                  </p>
                  <p className="text-xs text-muted">
                    {p.date} · {formatPeso(p.amount)} · {p.description}
                  </p>
                  {p.method && <p className="text-xs text-muted">Method: {p.method}</p>}
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      className="btn-gold"
                      onClick={() =>
                        onNavigate({ page: "documents", clientCode: p.clientCode, docTab: "ar" })
                      }
                    >
                      Issue AR
                    </button>
                    <button
                      type="button"
                      className="btn-gold"
                      onClick={() => onNavigate({ page: "clients", clientCode: p.clientCode })}
                    >
                      Matter
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "documents" && (
        <section className="card">
          <p className="section-label">Recent SOA & receipts</p>
          {!data.recentDocuments.length ? (
            <EmptyState message="No SOAs or receipts logged yet — your document trail starts here." />
          ) : (
            <div className="scroll-panel-hint firm-ledger-table-wrap">
              <table className="firm-ledger-table w-full min-w-[720px] text-left">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Document</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentDocuments.map((doc) => (
                    <tr key={doc.logRow}>
                      <td className="whitespace-nowrap text-muted">{doc.timestamp}</td>
                      <td>
                        <p className="font-bold text-ink">
                          <ClientCodeButton code={doc.clientCode} className="no-underline" />
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{doc.clientName}</p>
                      </td>
                      <td>
                        <p className="font-semibold text-ink">
                          {doc.documentType} {doc.documentNumber}
                        </p>
                        {doc.email ? <p className="mt-0.5 text-[11px] text-muted">{doc.email}</p> : null}
                      </td>
                      <td className="amount-serif text-right font-semibold text-ink">
                        {formatPeso(doc.amount)}
                      </td>
                      <td>
                        <span className="inline-flex rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark">
                          {doc.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {doc.pdfUrl ? (
                            <a
                              href={doc.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-gold inline-block px-2 py-1 text-[10px]"
                            >
                              PDF
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="btn-gold px-2 py-1 text-[10px]"
                            onClick={() => onNavigate({ page: "clients", clientCode: doc.clientCode })}
                          >
                            Client
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
  alert
}: {
  label: string;
  value: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-2 text-center ${
        alert
          ? "border-red-200 bg-red-50 ring-1 ring-red-200"
          : highlight
            ? "border-gold/25 bg-gold/10 ring-1 ring-gold/25"
            : "border-line/80 bg-white ring-1 ring-line/60"
      }`}
    >
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p
        className={`mt-1 ${alert ? "text-sm font-extrabold text-red-800" : highlight ? "amount-serif text-lg font-semibold text-ink sm:text-xl" : "text-sm font-extrabold text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function ClientRow({
  code,
  name,
  meta,
  onProfile,
  onSoa,
  onAr,
  onBilling,
  arLabel = "AR"
}: {
  code: string;
  name: string;
  meta: string;
  onProfile: () => void;
  onSoa?: () => void;
  onAr?: () => void;
  onBilling?: () => void;
  arLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-line/60 bg-white px-2.5 py-2">
      <p className="text-sm font-bold text-ink">
        <ClientCodeButton code={code} className="no-underline" /> — {name}
      </p>
      <p className="text-xs text-muted">{meta}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <button type="button" className="btn-gold" onClick={onProfile}>
          Matter
        </button>
        {onBilling && (
          <button type="button" className="btn-gold" onClick={onBilling}>
            Billing
          </button>
        )}
        {onSoa && (
          <button type="button" className="btn-gold" onClick={onSoa}>
            Send SOA
          </button>
        )}
        {onAr && (
          <button type="button" className="btn-gold" onClick={onAr}>
            {arLabel}
          </button>
        )}
      </div>
    </div>
  );
}
