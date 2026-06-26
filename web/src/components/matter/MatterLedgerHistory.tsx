"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LedgerEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { EmptyState } from "@/components/office-tasks/PremiumUI";

type LedgerFilter = "all" | "charge" | "payment";

type Props = {
  clientCode: string;
  entries: LedgerEntry[];
  busy: boolean;
  readOnly?: boolean;
  embedded?: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  onSaved: () => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">{label}</label>
      {children}
    </div>
  );
}

export function MatterLedgerHistory({
  clientCode,
  entries,
  busy,
  readOnly = false,
  embedded = false,
  onBusy,
  onStatus,
  onSaved
}: Props) {
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);

  const filteredEntries = useMemo(() => {
    if (filter === "all") return [...entries].reverse();
    return entries.filter((entry) => entry.type.toLowerCase() === filter).reverse();
  }, [entries, filter]);

  async function voidEntry(entry: LedgerEntry) {
    if (!window.confirm(`Void this ${entry.type.toLowerCase()} entry? This cannot be undone.`)) return;
    onBusy(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientCode, sheetRow: entry.sheetRow })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void entry.");
      onStatus(json.message || "Entry voided.");
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to void.", true);
    } finally {
      onBusy(false);
    }
  }

  async function saveEntryEdit() {
    if (!editingEntry) return;
    onBusy(true);
    try {
      const isPayment = editingEntry.type.toLowerCase() === "payment";
      const res = await fetch("/api/ledger", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode,
          sheetRow: editingEntry.sheetRow,
          date: editingEntry.date,
          category: editingEntry.category,
          description: editingEntry.description,
          charge: isPayment ? undefined : editingEntry.charge,
          payment: isPayment ? editingEntry.payment : undefined,
          method: editingEntry.method,
          details: editingEntry.details
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save entry.");
      onStatus(json.message || "Entry updated.");
      setEditingEntry(null);
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save.", true);
    } finally {
      onBusy(false);
    }
  }

  const sectionClass = embedded
    ? "matter-advanced-subsection"
    : "card matter-billing-section no-print scroll-mt-3";

  return (
    <>
      <section
        id={embedded ? "matter-advanced-history" : "matter-billing-history"}
        className={sectionClass}
      >
        {!embedded ? (
          <>
            <p className="matter-billing-section__step">Step 2</p>
            <h2 className="matter-billing-section__title">Billing history</h2>
            <p className="matter-billing-section__help mb-3">
              {readOnly
                ? "View past charges and payments. Ask the office admin if a line needs to be corrected."
                : "To correct a mistake, tap Edit or Void on the line below. Lines already on a sent SOA or with an AR issued cannot be changed here."}
            </p>
          </>
        ) : (
          <>
            <h3 className="matter-advanced-subsection__title">Fix past billing lines</h3>
            <p className="matter-advanced-subsection__help mb-3">
              Edit or void a charge or payment that has not been sent on an SOA or AR yet.
            </p>
          </>
        )}

        <div className="mb-3 flex flex-wrap gap-1">
          {(
            [
              ["all", "All"],
              ["charge", "Charges only"],
              ["payment", "Payments only"]
            ] as const
          ).map(([id, label]) => (
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

        {!filteredEntries.length ? (
          <EmptyState compact message="No transactions found for this filter." />
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => {
              const isPayment = entry.type.toLowerCase() === "payment";
              const isVoid = entry.type.toLowerCase() === "void";
              const amount = isPayment ? entry.payment : entry.charge;
              return (
                <article
                  key={entry.sheetRow}
                  className={`matter-ledger-history__row rounded-md border border-line/70 bg-[#faf9f7] p-2.5 ${isVoid ? "opacity-60" : ""}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">{entry.date}</p>
                      <p className="text-[11px] font-bold uppercase text-muted">{entry.type}</p>
                    </div>
                    <div className="text-right">
                      {!isVoid && (
                        <p
                          className={`matter-ledger-entry__amount font-extrabold ${isPayment ? "matter-ledger-entry__amount--payment" : "text-[#8b1e1e]"}`}
                        >
                          {isPayment ? "−" : "+"}
                          {formatPeso(amount)}
                        </p>
                      )}
                      {!readOnly && !isVoid && !entry.documentNumber && !entry.arSent ? (
                        <div className="matter-ledger-entry__actions">
                          <button
                            type="button"
                            className="matter-ledger-entry__action-btn matter-ledger-entry__action-btn--edit"
                            disabled={busy}
                            onClick={() => setEditingEntry({ ...entry })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="matter-ledger-entry__action-btn matter-ledger-entry__action-btn--void"
                            disabled={busy}
                            onClick={() => void voidEntry(entry)}
                          >
                            Void
                          </button>
                        </div>
                      ) : !isVoid && (entry.documentNumber || entry.arSent) ? (
                        <p className="matter-ledger-entry__locked">
                          {entry.documentNumber ? "Locked — on SOA/invoice" : "Locked — AR issued"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-ink">{entry.description || entry.category || "—"}</p>
                  {entry.category && entry.description ? (
                    <p className="text-xs text-muted">{entry.category}</p>
                  ) : null}
                  <div className="matter-ledger-history__meta mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted">
                    <span>
                      Balance: <span className="matter-ledger-entry__balance">{formatPeso(entry.balance)}</span>
                    </span>
                    {entry.method ? <span>Method: {entry.method}</span> : null}
                    {entry.details ? <span className="col-span-2">Details: {entry.details}</span> : null}
                    {entry.documentNumber ? <span>Doc #: {entry.documentNumber}</span> : null}
                    {isPayment ? <span>{entry.arSent ? "AR issued" : "No AR yet"}</span> : null}
                  </div>
                  {entry.pdfLink ? (
                    <a
                      href={entry.pdfLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-bold text-[#1a4d8f] underline"
                    >
                      View PDF
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!readOnly && editingEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm w-full">
            <p className="section-label">Edit {editingEntry.type}</p>
            <Field label="Description">
              <input
                className="field"
                value={editingEntry.description}
                disabled={busy}
                onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                className="field"
                value={editingEntry.category}
                disabled={busy}
                onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
              />
            </Field>
            <Field
              label={editingEntry.type.toLowerCase() === "payment" ? "Payment amount" : "Charge amount"}
            >
              <input
                className="field"
                type="number"
                step="0.01"
                value={
                  editingEntry.type.toLowerCase() === "payment" ? editingEntry.payment : editingEntry.charge
                }
                disabled={busy}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (editingEntry.type.toLowerCase() === "payment") {
                    setEditingEntry({ ...editingEntry, payment: val });
                  } else {
                    setEditingEntry({ ...editingEntry, charge: val });
                  }
                }}
              />
            </Field>
            <div className="form-grid-pair mt-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setEditingEntry(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn-gold" disabled={busy} onClick={() => void saveEntryEdit()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
