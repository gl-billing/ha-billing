"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotarizationEntry, WalkInBillingKind } from "@/lib/gl-config";
import { formatPeso, GL } from "@/lib/gl-config";
import { formatNotarizationReceiptIssuedDate, isNotarizationRetainer } from "@/lib/notarization-utils";
import { ReceiptCeremony, parseReceiptNumberFromMessage } from "@/components/ReceiptCeremony";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { NotarizationEditDialog } from "@/components/NotarizationEditDialog";
import type { NotarizationUpdatePayload } from "@/lib/gl-config";

const UNDO_WINDOW_MS = 30_000;

type PendingUndo = {
  receiptNo: string;
  name: string;
  previousStatus: string;
  expiresAt: number;
};

type Props = {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  paymentMethods?: string[];
};

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function RegisterRefCell({
  docNo,
  pageNo,
  bookNo,
  series
}: {
  docNo: string;
  pageNo: string;
  bookNo: string;
  series: string;
}) {
  const hasRef = [docNo, pageNo, bookNo, series].some((value) => value.trim());
  if (!hasRef) {
    return <span className="notarization-panel__ref-empty">—</span>;
  }

  const items = [
    { label: "Doc", value: docNo },
    { label: "Page", value: pageNo },
    { label: "Book", value: bookNo },
    { label: "Series", value: series }
  ];

  return (
    <div className="notarization-panel__ref-grid" aria-label="Notarial book reference">
      {items.map((item) => (
        <div key={item.label} className="notarization-panel__ref-item">
          <span className="notarization-panel__ref-label">{item.label}</span>
          <span className="notarization-panel__ref-value">{item.value.trim() || "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function NotarizationPanel({ busy, onBusy, onStatus, paymentMethods }: Props) {
  const methods = paymentMethods && paymentMethods.length ? paymentMethods : [...GL.paymentMethods];

  const [entries, setEntries] = useState<NotarizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NotarizationEntry | null>(null);

  const [date, setDate] = useState(todayLocal());
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [docNo, setDocNo] = useState("");
  const [pageNo, setPageNo] = useState("");
  const [bookNo, setBookNo] = useState("");
  const [series, setSeries] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState("");
  const [billingKind, setBillingKind] = useState<WalkInBillingKind>("charge");
  const [method, setMethod] = useState<string>(methods[0]);
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [generateReceipt, setGenerateReceipt] = useState(true);
  const [clientCode, setClientCode] = useState("");
  const [postToLedger, setPostToLedger] = useState(false);
  const [issuingReceiptNo, setIssuingReceiptNo] = useState<string | null>(null);
  const [receiptCeremony, setReceiptCeremony] = useState<{ receiptNumber: string; amount: number } | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notarizations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load notarizations.");
      setEntries(json.notarizations || []);
      setCanManage(Boolean(json.canManage ?? json.isAdmin));
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load notarizations.", true);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  function clearPendingUndo() {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setPendingUndo(null);
  }

  function scheduleUndo(entry: NotarizationEntry, previousStatus = entry.status || "Recorded") {
    clearPendingUndo();
    const pending: PendingUndo = {
      receiptNo: entry.receiptNo,
      name: entry.name,
      previousStatus,
      expiresAt: Date.now() + UNDO_WINDOW_MS
    };
    setPendingUndo(pending);
    undoTimerRef.current = window.setTimeout(() => {
      setPendingUndo(null);
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  }

  function resetForm() {
    setName("");
    setAddress("");
    setDocumentType("");
    setDocNo("");
    setPageNo("");
    setBookNo("");
    setAmount("");
    setBillingKind("charge");
    setDetails("");
    setNotes("");
    setDate(todayLocal());
    setSeries(String(new Date().getFullYear()));
    setGenerateReceipt(true);
    setClientCode("");
    setPostToLedger(false);
  }

  async function submit() {
    if (!name.trim() || !documentType.trim()) {
      onStatus("Name and document type are required.", true);
      return;
    }
    const isRetainer = billingKind === "retainer";
    if (!isRetainer && (!amount || Number(amount) <= 0)) {
      onStatus("Enter a valid amount, or choose Retainer (no charge).", true);
      return;
    }

    onBusy(true);
    try {
      const res = await fetch("/api/notarizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name: name.trim(),
          address: address.trim(),
          documentType: documentType.trim(),
          docNo: docNo.trim(),
          pageNo: pageNo.trim(),
          bookNo: bookNo.trim(),
          series: series.trim(),
          billingKind,
          amount: isRetainer ? 0 : Number(amount),
          paymentMethod: isRetainer ? undefined : method,
          paymentDetails: isRetainer ? undefined : details.trim(),
          notes: notes.trim(),
          generateReceipt,
          clientCode: clientCode.trim() || undefined,
          postToLedger: !isRetainer && postToLedger && Boolean(clientCode.trim())
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record notarization.");
      if (!json.warning && json.notarization?.pdfLink) {
        setReceiptCeremony({
          receiptNumber: parseReceiptNumberFromMessage(
            json.notarization.receiptNo || json.message || "",
            json.notarization.receiptNo || "Receipt issued"
          ),
          amount: isRetainer ? 0 : Number(amount)
        });
      }
      onStatus(json.message || "Notarization recorded.", Boolean(json.warning));
      resetForm();
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record notarization.", true);
    } finally {
      onBusy(false);
    }
  }

  async function saveEdit(payload: NotarizationUpdatePayload) {
    if (!payload.name.trim() || !payload.documentType.trim()) {
      onStatus("Name and document type are required.", true);
      return;
    }
    const isRetainer = payload.billingKind === "retainer";
    if (!isRetainer && (!payload.amount || Number(payload.amount) <= 0)) {
      onStatus("Enter a valid amount, or choose Retainer (no charge).", true);
      return;
    }

    onBusy(true);
    try {
      const res = await fetch("/api/notarizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update notarization.");
      setEditingEntry(null);
      onStatus(json.message || "Notarization updated.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not update notarization.", true);
    } finally {
      onBusy(false);
    }
  }

  async function remove(entry: NotarizationEntry) {
    if (!canManage) {
      onStatus("Only firm admins and desk editors can edit or delete notarizations.", true);
      return;
    }
    if (
      !window.confirm(
        `Delete notarization ${entry.receiptNo} (${entry.name})? You can undo for 30 seconds after deleting.`
      )
    ) {
      return;
    }
    onBusy(true);
    try {
      const res = await fetch(`/api/notarizations?receiptNo=${encodeURIComponent(entry.receiptNo)}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete notarization.");
      if (json.undo?.receiptNo) {
        scheduleUndo(entry, json.undo.previousStatus || entry.status || "Recorded");
      }
      onStatus(`${json.message || "Notarization deleted."} Use Undo below if this was a mistake.`);
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not delete notarization.", true);
    } finally {
      onBusy(false);
    }
  }

  async function issueReceipt(entry: NotarizationEntry) {
    if (entry.pdfLink) {
      const issuedOn = formatNotarizationReceiptIssuedDate(entry.receiptIssuedAt);
      onStatus(
        issuedOn
          ? `An acknowledgment receipt was already issued on ${issuedOn}.`
          : "An acknowledgment receipt was already issued for this notarization.",
        true
      );
      return;
    }

    onBusy(true);
    setIssuingReceiptNo(entry.receiptNo);
    try {
      const res = await fetch("/api/notarizations/issue-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptNo: entry.receiptNo })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not issue receipt.");
      setReceiptCeremony({
        receiptNumber: parseReceiptNumberFromMessage(json.receiptNumber || json.message || entry.receiptNo, entry.receiptNo),
        amount: entry.amount
      });
      onStatus(json.message || "Acknowledgment receipt issued.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not issue receipt.", true);
    } finally {
      setIssuingReceiptNo(null);
      onBusy(false);
    }
  }

  async function undoDelete() {
    if (!pendingUndo) return;
    onBusy(true);
    try {
      const res = await fetch("/api/notarizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNo: pendingUndo.receiptNo,
          previousStatus: pendingUndo.previousStatus
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not restore notarization.");
      clearPendingUndo();
      onStatus(json.message || "Notarization restored.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not restore notarization.", true);
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="notarization-panel">
      {receiptCeremony ? (
        <ReceiptCeremony
          receiptNumber={receiptCeremony.receiptNumber}
          amount={receiptCeremony.amount}
          subtitle="Notarial acknowledgment receipt saved and ready to print or email."
          onDismiss={() => setReceiptCeremony(null)}
        />
      ) : null}

      {pendingUndo ? (
        <div className="notarization-panel__undo-bar card mb-4" role="status">
          <div className="notarization-panel__undo-bar__copy">
            <p className="notarization-panel__undo-bar__title">
              <strong>{pendingUndo.receiptNo}</strong> ({pendingUndo.name}) was deleted.
            </p>
            <p className="notarization-panel__undo-bar__hint">You have 30 seconds to undo.</p>
          </div>
          <button
            type="button"
            className="notarization-panel__undo-btn"
            disabled={busy}
            onClick={() => void undoDelete()}
          >
            Undo delete
          </button>
        </div>
      ) : null}

      <section className="card notarization-panel__add-form">
        <div className="notarization-panel__card-head">
          <p className="notarization-panel__step">01 · Record notarization</p>
          <h2 className="notarization-panel__card-title">Log notarized document</h2>
          <p className="notarization-panel__card-lede">
            Signatory and document details first, then book reference, payment, and optional receipt or ledger posting.
          </p>
        </div>

        <div className="notarization-panel__form-block">
          <p className="notarization-panel__block-label">Signatory &amp; document</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Date *">
              <input className="field" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Name *">
              <input className="field" value={name} disabled={busy} placeholder="Signatory / payor" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Document type *">
              <input className="field" value={documentType} disabled={busy} placeholder="e.g. Affidavit of Loss, Deed of Sale" onChange={(e) => setDocumentType(e.target.value)} />
            </Field>
            <Field label="Address (for receipt)">
              <input className="field" value={address} disabled={busy} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="notarization-panel__register-block">
          <p className="notarization-panel__block-label">Notarial book reference</p>
          <div className="notarization-panel__ref-form-grid">
            <Field label="Doc No.">
              <input className="field notarization-panel__ref-input" value={docNo} disabled={busy} onChange={(e) => setDocNo(e.target.value)} />
            </Field>
            <Field label="Page No.">
              <input className="field notarization-panel__ref-input" value={pageNo} disabled={busy} onChange={(e) => setPageNo(e.target.value)} />
            </Field>
            <Field label="Book No.">
              <input className="field notarization-panel__ref-input" value={bookNo} disabled={busy} onChange={(e) => setBookNo(e.target.value)} />
            </Field>
            <Field label="Series">
              <input className="field notarization-panel__ref-input" value={series} disabled={busy} onChange={(e) => setSeries(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="notarization-panel__payment-block">
          <p className="notarization-panel__block-label">Payment</p>
          <BillingKindToggle
            value={billingKind}
            disabled={busy}
            onChange={(kind) => {
              setBillingKind(kind);
              if (kind === "retainer") setPostToLedger(false);
            }}
          />
          {billingKind === "charge" ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="Amount *">
                <input className="field" type="number" min="0" step="0.01" value={amount} disabled={busy} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Payment method">
                <select className="field" value={method} disabled={busy} onChange={(e) => setMethod(e.target.value)}>
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment details">
                <input className="field" value={details} disabled={busy} placeholder="Reference / notes" onChange={(e) => setDetails(e.target.value)} />
              </Field>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Retainer client — notarial act is logged in the register with no fee or payment.
            </p>
          )}
        </div>

        <Field label="Notes">
          <textarea className="field min-h-[64px]" value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className={`notarization-panel__ledger-block ${billingKind === "retainer" ? "notarization-panel__ledger-block--muted" : ""}`}>
          <p className="notarization-panel__block-label">Optional · client ledger</p>
          {billingKind === "retainer" ? (
            <p className="text-sm text-muted">Ledger posting is not available for retainer (no-charge) notarizations.</p>
          ) : (
            <>
              <div className="notarization-panel__ledger-fields grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Client code">
                  <input
                    className="field"
                    value={clientCode}
                    disabled={busy}
                    placeholder="e.g. RET-ABC — for matter ledger"
                    onChange={(e) => setClientCode(e.target.value.toUpperCase())}
                  />
                </Field>
              </div>
              <label className="form-check form-check--premium notarization-panel__option notarization-panel__ledger-option">
                <input
                  type="checkbox"
                  checked={postToLedger}
                  disabled={busy || !clientCode.trim()}
                  onChange={(e) => setPostToLedger(e.target.checked)}
                />
                <span className="form-check__copy">
                  <span className="form-check__text">Also post payment to client ledger (Notarial Fee)</span>
                  {!clientCode.trim() ? (
                    <span className="form-check__hint">Enter a client code above to enable ledger posting.</span>
                  ) : null}
                </span>
              </label>
            </>
          )}
        </div>

        <div className="notarization-panel__options">
          <p className="notarization-panel__block-label">Acknowledgment receipt</p>
          <label className="form-check form-check--premium notarization-panel__option">
            <input
              type="checkbox"
              checked={generateReceipt}
              disabled={busy}
              onChange={(e) => setGenerateReceipt(e.target.checked)}
            />
            <span className="form-check__copy">
              <span className="form-check__text">Generate acknowledgment receipt PDF</span>
              <span className="form-check__hint">
                Print and hand to the client — same format as matter billing receipts.
              </span>
            </span>
          </label>
        </div>

        {!generateReceipt ? (
          <p className="notarization-panel__receipt-hint">
            The notarization will be saved without a receipt. Use <strong>Issue receipt</strong> in the register
            when ready.
          </p>
        ) : null}

        <div className="btn-row notarization-panel__add-actions">
          <button type="button" className="btn-primary notarization-panel__add-btn" disabled={busy} onClick={() => void submit()}>
            {busy ? "Saving…" : "Record notarization"}
          </button>
        </div>
      </section>

      <section className="card notarization-panel__register-card">
        <div className="notarization-panel__card-head notarization-panel__card-head--compact">
          <div className="notarization-panel__section-head">
            <div>
              <p className="notarization-panel__step">02 · Notarial register</p>
              <h2 className="notarization-panel__card-title">Recorded notarizations</h2>
              <p className="notarization-panel__card-lede">
                Book, page, and document numbers with acknowledgment receipt status — issue or view PDFs from each row.
              </p>
            </div>
            {!loading && entries.length > 0 ? (
              <span className="notarization-panel__register-count">{entries.length} recorded</span>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="notarization-panel__loading">Loading notarizations…</p>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Register is empty"
            message="No notarizations recorded yet — log the first entry using the form above."
          />
        ) : (
          <div className="notarization-panel__table-wrap firm-ledger-table-wrap">
            <table className="notarization-panel__table firm-ledger-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Signatory</th>
                  <th>Document</th>
                  <th className="notarization-panel__col-ref">Register reference</th>
                  <th className="notarization-panel__col-money">Amount</th>
                  <th>Method</th>
                  <th>Receipt PDF</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.receiptNo}>
                    <td data-label="Receipt">
                      <span className="notarization-panel__receipt-no">{entry.receiptNo}</span>
                    </td>
                    <td data-label="Date">{entry.date || "—"}</td>
                    <td data-label="Signatory">{entry.name}</td>
                    <td data-label="Document">{entry.documentType}</td>
                    <td data-label="Register reference" className="notarization-panel__col-ref">
                      <RegisterRefCell
                        docNo={entry.docNo}
                        pageNo={entry.pageNo}
                        bookNo={entry.bookNo}
                        series={entry.series}
                      />
                    </td>
                    <td data-label="Amount" className="notarization-panel__col-money">
                      {isNotarizationRetainer(entry) ? (
                        <span className="notarization-panel__amount-retainer">Retainer · no charge</span>
                      ) : (
                        <span className="amount-serif">{formatPeso(entry.amount)}</span>
                      )}
                    </td>
                    <td data-label="Method">{isNotarizationRetainer(entry) ? "Retainer" : entry.paymentMethod || "—"}</td>
                    <td data-label="Receipt PDF">
                      <ReceiptCell
                        entry={entry}
                        busy={busy}
                        issuing={issuingReceiptNo === entry.receiptNo}
                        onIssue={() => void issueReceipt(entry)}
                      />
                    </td>
                    {canManage ? (
                      <td data-label="Actions">
                        <div className="notarization-panel__row-actions">
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => setEditingEntry(entry)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm notarization-panel__delete-btn"
                            disabled={busy}
                            onClick={() => void remove(entry)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingEntry ? (
        <NotarizationEditDialog
          entry={editingEntry}
          open={Boolean(editingEntry)}
          busy={busy}
          paymentMethods={paymentMethods}
          onClose={() => setEditingEntry(null)}
          onSave={(payload) => void saveEdit(payload)}
        />
      ) : null}
    </div>
  );
}

function ReceiptCell({
  entry,
  busy,
  issuing,
  onIssue
}: {
  entry: NotarizationEntry;
  busy: boolean;
  issuing: boolean;
  onIssue: () => void;
}) {
  if (entry.pdfLink) {
    const issuedOn = formatNotarizationReceiptIssuedDate(entry.receiptIssuedAt);
    return (
      <div className="notarization-panel__receipt-cell">
        <p className="notarization-panel__receipt-issued-note">
          Acknowledgment receipt already issued
          {issuedOn ? (
            <>
              {" "}
              on <strong>{issuedOn}</strong>
            </>
          ) : null}
          .
        </p>
        <a className="notarization-panel__pdf-link" href={entry.pdfLink} target="_blank" rel="noreferrer">
          View PDF
        </a>
      </div>
    );
  }

  return (
    <div className="notarization-panel__receipt-cell">
      <span className="notarization-panel__receipt-pending">No receipt yet</span>
      <button
        type="button"
        className="notarization-panel__issue-receipt-btn"
        disabled={busy || issuing}
        onClick={onIssue}
      >
        {issuing ? "Issuing…" : "Issue receipt"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="notarization-panel__field">
      <span className="notarization-panel__field-label">{label}</span>
      {children}
    </label>
  );
}

function BillingKindToggle({
  value,
  onChange,
  disabled,
  className = ""
}: {
  value: WalkInBillingKind;
  onChange: (kind: WalkInBillingKind) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`walk-in-panel__billing-kind ${className}`.trim()}>
      <span className="field-label">Fee type</span>
      <div className="walk-in-panel__billing-kind-options" role="group" aria-label="Fee type">
        <button
          type="button"
          className={`walk-in-panel__billing-kind-btn ${value === "charge" ? "walk-in-panel__billing-kind-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange("charge")}
        >
          Enter amount
        </button>
        <button
          type="button"
          className={`walk-in-panel__billing-kind-btn ${value === "retainer" ? "walk-in-panel__billing-kind-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange("retainer")}
        >
          Retainer (no charge)
        </button>
      </div>
    </div>
  );
}
