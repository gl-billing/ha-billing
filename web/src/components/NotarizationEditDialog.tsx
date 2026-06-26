"use client";

import { useEffect, useState } from "react";
import type { NotarizationEntry, NotarizationUpdatePayload, WalkInBillingKind } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { formatNotarizationReceiptIssuedDate, isNotarizationRetainer } from "@/lib/notarization-utils";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = {
  entry: NotarizationEntry;
  open: boolean;
  busy?: boolean;
  paymentMethods?: string[];
  onClose: () => void;
  onSave: (payload: NotarizationUpdatePayload) => void;
};

export function NotarizationEditDialog({ entry, open, busy, paymentMethods, onClose, onSave }: Props) {
  useBodyScrollLock(open);
  const methods = paymentMethods && paymentMethods.length ? paymentMethods : [...GL.paymentMethods];

  const [date, setDate] = useState(entry.date);
  const [name, setName] = useState(entry.name);
  const [address, setAddress] = useState(entry.address);
  const [documentType, setDocumentType] = useState(entry.documentType);
  const [docNo, setDocNo] = useState(entry.docNo);
  const [pageNo, setPageNo] = useState(entry.pageNo);
  const [bookNo, setBookNo] = useState(entry.bookNo);
  const [series, setSeries] = useState(entry.series);
  const [amount, setAmount] = useState(entry.amount ? String(entry.amount) : "");
  const [billingKind, setBillingKind] = useState<WalkInBillingKind>(
    isNotarizationRetainer(entry) ? "retainer" : "charge"
  );
  const [method, setMethod] = useState(entry.paymentMethod || methods[0]);
  const [details, setDetails] = useState(entry.paymentDetails);
  const [notes, setNotes] = useState(entry.notes);
  const [clientCode, setClientCode] = useState(entry.clientCode);

  useEffect(() => {
    if (!open) return;
    const defaultMethod = paymentMethods?.[0] ?? GL.paymentMethods[0];
    setDate(entry.date);
    setName(entry.name);
    setAddress(entry.address);
    setDocumentType(entry.documentType);
    setDocNo(entry.docNo);
    setPageNo(entry.pageNo);
    setBookNo(entry.bookNo);
    setSeries(entry.series);
    setAmount(entry.amount ? String(entry.amount) : "");
    setBillingKind(isNotarizationRetainer(entry) ? "retainer" : "charge");
    setMethod(entry.paymentMethod || defaultMethod);
    setDetails(entry.paymentDetails);
    setNotes(entry.notes);
    setClientCode(entry.clientCode);
  }, [entry, open, paymentMethods]);

  if (!open) return null;

  const hasReceiptPdf = Boolean(entry.pdfLink.trim());
  const issuedOn = formatNotarizationReceiptIssuedDate(entry.receiptIssuedAt);

  function submit() {
    if (!name.trim() || !documentType.trim()) return;
    const isRetainer = billingKind === "retainer";
    if (!isRetainer && (!amount || Number(amount) <= 0)) return;

    onSave({
      receiptNo: entry.receiptNo,
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
      clientCode: clientCode.trim() || undefined,
      notes: notes.trim()
    });
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="notarization-edit-title">
        <div className="modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto">
          <header className="notarization-panel__card-head notarization-panel__card-head--compact">
            <p className="notarization-panel__step">Edit · {entry.receiptNo}</p>
            <h2 id="notarization-edit-title" className="notarization-panel__card-title">
              Correct notarization record
            </h2>
            <p className="notarization-panel__card-lede">
              Update signatory, document, register reference, or payment details. Receipt number and recorded-by stay
              unchanged.
            </p>
          </header>

          {hasReceiptPdf ? (
            <p className="notarization-panel__edit-receipt-note" role="status">
              An acknowledgment receipt was already issued
              {issuedOn ? (
                <>
                  {" "}
                  on <strong>{issuedOn}</strong>
                </>
              ) : null}
              . Saving edits will not regenerate the PDF — contact an admin if a new receipt is needed.
            </p>
          ) : null}

          <div className="notarization-panel__form-block mt-4">
            <p className="notarization-panel__block-label">Signatory &amp; document</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Date *">
                <input className="field" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Name *">
                <input className="field" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Document type *">
                <input className="field" value={documentType} disabled={busy} onChange={(e) => setDocumentType(e.target.value)} />
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
              onChange={(kind) => setBillingKind(kind)}
            />
            {billingKind === "charge" ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Amount *">
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    disabled={busy}
                    onChange={(e) => setAmount(e.target.value)}
                  />
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
                  <input className="field" value={details} disabled={busy} onChange={(e) => setDetails(e.target.value)} />
                </Field>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Retainer client — no fee or payment on this record.</p>
            )}
          </div>

          <Field label="Client code">
            <input
              className="field"
              value={clientCode}
              disabled={busy}
              placeholder="Optional matter code"
              onChange={(e) => setClientCode(e.target.value.toUpperCase())}
            />
          </Field>

          <Field label="Notes">
            <textarea className="field min-h-[64px]" value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="btn-row mt-4">
            <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
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
  disabled
}: {
  value: WalkInBillingKind;
  onChange: (kind: WalkInBillingKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="walk-in-panel__billing-kind">
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
