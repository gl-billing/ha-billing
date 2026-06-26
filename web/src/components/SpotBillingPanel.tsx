"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { TableSkeleton } from "@/components/Skeleton";
import { fetchJson } from "@/lib/fetch-json";
import type { SpotBillingEntry, SpotBillingTransactionKind, SpotBillingTransactionPayload } from "@/lib/gl-config";
import { formatPeso, GL } from "@/lib/gl-config";
import type { SpotBillingLetterKind } from "@/lib/spot-billing-letter";

type Props = {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  paymentMethods?: string[];
};

type Filter = "active" | "closed" | "all";

const SERVICE_TYPES = [
  "Professional Fee",
  "Acceptance Fee",
  "Notarial Fee",
  "Filing Fee",
  "Document Fee",
  "Reimbursement / Expense",
  "Other"
] as const;

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function billingSummary(entry: SpotBillingEntry): string {
  if (entry.billingStatus === "Retainer") return "Retainer · no charge";
  if (!entry.chargeAmount && !entry.paymentAmount) return "No transactions yet";
  const parts: string[] = [];
  if (entry.chargeAmount > 0) parts.push(`charges ${formatPeso(entry.chargeAmount)}`);
  if (entry.paymentAmount > 0) parts.push(`payments ${formatPeso(entry.paymentAmount)}`);
  if (entry.billingStatus) parts.push(entry.billingStatus);
  if (entry.assignedAttorney) parts.push(entry.assignedAttorney);
  return parts.join(" · ");
}

function buildTransactionPayload(
  kind: SpotBillingTransactionKind,
  serviceType: string,
  amountCharge: string,
  amountPayment: string,
  payMethod: string,
  date: string,
  description: string
): SpotBillingTransactionPayload {
  if (kind === "retainer") {
    return {
      serviceType,
      transactionKind: "retainer",
      date,
      description: description.trim() || undefined
    };
  }

  if (kind === "payment") {
    const paymentValue = Number(amountPayment);
    if (!paymentValue || paymentValue <= 0) {
      throw new Error("Enter a valid payment amount.");
    }
    return {
      serviceType,
      transactionKind: "payment",
      payment: paymentValue,
      method: payMethod,
      date,
      description: description.trim() || undefined
    };
  }

  const chargeValue = Number(amountCharge);
  if (!chargeValue || chargeValue <= 0) {
    throw new Error("Enter a valid charge amount.");
  }
  return {
    serviceType,
    transactionKind: "charge",
    charge: chargeValue,
    date,
    description: description.trim() || undefined
  };
}

export function SpotBillingPanel({ busy, onBusy, onStatus, paymentMethods }: Props) {
  const methods = paymentMethods && paymentMethods.length ? paymentMethods : [...GL.paymentMethods];
  const [entries, setEntries] = useState<SpotBillingEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transactionEntry, setTransactionEntry] = useState<SpotBillingEntry | null>(null);

  const [payerName, setPayerName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [linkedClientCode, setLinkedClientCode] = useState("");
  const [assignedAttorney, setAssignedAttorney] = useState("");
  const [notes, setNotes] = useState("");
  const [billNow, setBillNow] = useState(true);
  const [billingKind, setBillingKind] = useState<SpotBillingTransactionKind>("charge");
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [charge, setCharge] = useState("");
  const [payment, setPayment] = useState("");
  const [method, setMethod] = useState<string>(methods[0]);
  const [billingDate, setBillingDate] = useState(todayLocal());
  const [transactionDescription, setTransactionDescription] = useState("");
  const [sendOnLetterhead, setSendOnLetterhead] = useState(false);

  const [txnServiceType, setTxnServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [txnBillingKind, setTxnBillingKind] = useState<SpotBillingTransactionKind>("charge");
  const [txnCharge, setTxnCharge] = useState("");
  const [txnPayment, setTxnPayment] = useState("");
  const [txnMethod, setTxnMethod] = useState<string>(methods[0]);
  const [txnDate, setTxnDate] = useState(todayLocal());
  const [txnDescription, setTxnDescription] = useState("");
  const [txnSendOnLetterhead, setTxnSendOnLetterhead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spot-billing?status=${filter === "all" ? "" : filter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load spot billing.");
      setEntries(json.entries || []);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load spot billing.", true);
    } finally {
      setLoading(false);
    }
  }, [filter, onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCount = useMemo(() => entries.length, [entries]);

  async function sendSpotLetter(
    entry: SpotBillingEntry,
    transaction: SpotBillingTransactionPayload,
    kind: SpotBillingLetterKind,
    mode: "send" | "draft" = "send"
  ) {
    const recipientEmail = entry.email.trim();
    if (!recipientEmail) {
      onStatus("Add a payer email before sending on letterhead.", true);
      return;
    }

    onBusy(true);
    try {
      const { ok, data } = await fetchJson<{ ok?: boolean; message?: string; error?: string }>(
        `/api/spot-billing/${encodeURIComponent(entry.spotId)}/letter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: mode,
            kind,
            transaction,
            recipientEmail
          })
        }
      );
      if (!ok) throw new Error(data.error || "Could not send letter.");
      onStatus(data.message || "Letter sent.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not send letter.", true);
    } finally {
      onBusy(false);
    }
  }

  async function downloadSpotLetter(entry: SpotBillingEntry, transaction: SpotBillingTransactionPayload, kind: SpotBillingLetterKind) {
    onBusy(true);
    try {
      const response = await fetch(`/api/spot-billing/${encodeURIComponent(entry.spotId)}/letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pdf", kind, transaction })
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "PDF download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        `Spot-${entry.spotId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus("Letter PDF downloaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "PDF download failed.", true);
    } finally {
      onBusy(false);
    }
  }

  async function submitNewEntry(addAnother = false) {
    if (!payerName.trim() || !serviceDescription.trim()) {
      onStatus("Payer name and service description are required.", true);
      return;
    }

    onBusy(true);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        payerName: payerName.trim(),
        serviceDescription: serviceDescription.trim(),
        phone: phone.trim(),
        email: email.trim(),
        linkedClientCode: linkedClientCode.trim(),
        assignedAttorney: assignedAttorney.trim(),
        notes: notes.trim()
      };

      let billing: SpotBillingTransactionPayload | undefined;
      if (billNow) {
        billing = buildTransactionPayload(
          billingKind,
          serviceType,
          charge,
          payment,
          method,
          billingDate,
          transactionDescription
        );
        payload.billing = billing;
      }

      const res = await fetch("/api/spot-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save spot billing.");

      const entry = json.entry as SpotBillingEntry;
      if (!addAnother) {
        setPayerName("");
        setServiceDescription("");
        setPhone("");
        setEmail("");
        setLinkedClientCode("");
        setAssignedAttorney("");
        setNotes("");
        setCharge("");
        setPayment("");
        setTransactionDescription("");
      }
      onStatus(
        addAnother
          ? `${json.message || "Spot billing saved."} Add another below.`
          : json.message || "Spot billing saved."
      );
      await load();

      if (billNow && billing && sendOnLetterhead && entry) {
        const kind: SpotBillingLetterKind = billingKind === "payment" ? "payment" : "charge";
        if (billingKind !== "retainer") {
          await sendSpotLetter(entry, billing, kind);
        }
      }
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save spot billing.", true);
    } finally {
      onBusy(false);
      setSaving(false);
    }
  }

  async function submitTransaction() {
    if (!transactionEntry) return;

    onBusy(true);
    setSaving(true);
    try {
      const billing = buildTransactionPayload(
        txnBillingKind,
        txnServiceType,
        txnCharge,
        txnPayment,
        txnMethod,
        txnDate,
        txnDescription
      );

      const res = await fetch(`/api/spot-billing/${encodeURIComponent(transactionEntry.spotId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transaction", billing })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record transaction.");

      const entry = json.entry as SpotBillingEntry;
      setTransactionEntry(null);
      onStatus(json.message || "Transaction recorded.");
      await load();

      if (txnSendOnLetterhead && txnBillingKind !== "retainer") {
        const kind: SpotBillingLetterKind = txnBillingKind === "payment" ? "payment" : "charge";
        await sendSpotLetter(entry, billing, kind);
      }
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record transaction.", true);
    } finally {
      onBusy(false);
      setSaving(false);
    }
  }

  async function closeEntry(entry: SpotBillingEntry) {
    onBusy(true);
    try {
      const res = await fetch(`/api/spot-billing/${encodeURIComponent(entry.spotId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not close spot billing.");
      onStatus(json.message || "Spot billing closed.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not close spot billing.", true);
    } finally {
      onBusy(false);
    }
  }

  function summaryTransaction(entry: SpotBillingEntry, kind: SpotBillingLetterKind): SpotBillingTransactionPayload {
    if (kind === "payment") {
      return {
        transactionKind: "payment",
        serviceType: entry.serviceType || SERVICE_TYPES[0],
        payment: entry.paymentAmount,
        method: entry.paymentMethod || methods[0],
        date: entry.lastBillingDate || todayLocal(),
        description: entry.serviceDescription
      };
    }
    return {
      transactionKind: "charge",
      serviceType: entry.serviceType || SERVICE_TYPES[0],
      charge: entry.chargeAmount,
      date: entry.lastBillingDate || todayLocal(),
      description: entry.serviceDescription
    };
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div>
          <p className="section-label mb-1">New occasional payer</p>
          <p className="text-xs text-muted">
            For one- or two-time payers who are not walk-in consults and do not need a full client file on Master List.
            Record charges (fees/expenses) and payments separately; send each on firm letterhead with the assigned lawyer.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payer name</span>
            <input className="field" value={payerName} disabled={saving} onChange={(e) => setPayerName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Service / matter</span>
            <input
              className="field"
              value={serviceDescription}
              disabled={saving}
              placeholder="e.g. Document review, single consultation"
              onChange={(e) => setServiceDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Phone</span>
            <input className="field" value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Email</span>
            <input className="field" value={email} disabled={saving} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Linked client code (optional)</span>
            <input
              className="field"
              value={linkedClientCode}
              disabled={saving}
              placeholder="Prefills assigned lawyer"
              onChange={(e) => setLinkedClientCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Assigned lawyer</span>
            <input
              className="field"
              value={assignedAttorney}
              disabled={saving}
              placeholder="e.g. Atty. Janine"
              onChange={(e) => setAssignedAttorney(e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Notes</span>
          <textarea className="field min-h-[64px]" value={notes} disabled={saving} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input type="checkbox" checked={billNow} disabled={saving} onChange={(e) => setBillNow(e.target.checked)} />
          Record first charge or payment now
        </label>

        {billNow ? (
          <div className="rounded-lg border border-line/70 bg-[#faf8f4] p-3 space-y-3">
            <TransactionKindToggle value={billingKind} disabled={saving} onChange={setBillingKind} />

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Service type</span>
              <select className="field" value={serviceType} disabled={saving} onChange={(e) => setServiceType(e.target.value)}>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            {billingKind === "charge" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Charge amount</span>
                  <input className="field" inputMode="decimal" value={charge} disabled={saving} onChange={(e) => setCharge(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Charge date</span>
                  <input type="date" className="field" value={billingDate} disabled={saving} onChange={(e) => setBillingDate(e.target.value)} />
                </label>
              </div>
            ) : null}

            {billingKind === "payment" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment amount</span>
                  <input className="field" inputMode="decimal" value={payment} disabled={saving} onChange={(e) => setPayment(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment method</span>
                  <select className="field" value={method} disabled={saving} onChange={(e) => setMethod(e.target.value)}>
                    {methods.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment date</span>
                  <input type="date" className="field" value={billingDate} disabled={saving} onChange={(e) => setBillingDate(e.target.value)} />
                </label>
              </div>
            ) : null}

            {billingKind === "retainer" ? (
              <p className="text-sm text-muted">Retainer note only — no charge or payment amount.</p>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Transaction note</span>
              <input
                className="field"
                value={transactionDescription}
                disabled={saving}
                placeholder="Optional detail for the log and letter"
                onChange={(e) => setTransactionDescription(e.target.value)}
              />
            </label>

            {billingKind !== "retainer" ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={sendOnLetterhead}
                  disabled={saving || !email.trim()}
                  onChange={(e) => setSendOnLetterhead(e.target.checked)}
                />
                Email {billingKind === "payment" ? "acknowledgment receipt" : "billing notice"} on letterhead after saving
              </label>
            ) : null}
          </div>
        ) : null}

        <button type="button" className="btn-primary" disabled={saving} onClick={() => void submitNewEntry(false)}>
          Save spot billing
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={() => void submitNewEntry(true)}>
          Save &amp; add another
        </button>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="section-label mb-0">Spot billing register</p>
            <p className="text-xs text-muted">{filteredCount} record(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["active", "closed", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}
                disabled={saving}
                onClick={() => setFilter(value)}
              >
                {value === "active" ? "Open" : value === "closed" ? "Closed" : "All"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : entries.length === 0 ? (
          <EmptyState
            message="No spot billing entries yet."
            action={
              <button type="button" className="btn-primary" disabled={saving} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Add spot billing
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-bold">ID</th>
                  <th className="py-2 pr-3 font-bold">Payer</th>
                  <th className="py-2 pr-3 font-bold">Service</th>
                  <th className="py-2 pr-3 font-bold">Billing</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.spotId} className="border-b border-line/60 align-top">
                    <td className="py-3 pr-3 font-mono text-[11px]">{entry.spotId}</td>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-ink">{entry.payerName}</p>
                      {entry.linkedClientCode ? <p className="text-muted">Ref {entry.linkedClientCode}</p> : null}
                      {entry.assignedAttorney ? <p className="text-muted">{entry.assignedAttorney}</p> : null}
                    </td>
                    <td className="py-3 pr-3">{entry.serviceDescription}</td>
                    <td className="py-3 pr-3">{billingSummary(entry)}</td>
                    <td className="py-3 pr-3">{entry.status}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {entry.status === "Active" ? (
                          <>
                            <button
                              type="button"
                              className="btn-secondary px-2 py-1 text-[11px]"
                              disabled={busy || saving}
                              onClick={() => {
                                setTransactionEntry(entry);
                                setTxnCharge("");
                                setTxnPayment("");
                                setTxnDescription("");
                                setTxnDate(todayLocal());
                                setTxnBillingKind("charge");
                                setTxnSendOnLetterhead(false);
                              }}
                            >
                              Add transaction
                            </button>
                            {entry.chargeAmount > 0 ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink"
                                  disabled={busy || saving}
                                  onClick={() =>
                                    void downloadSpotLetter(entry, summaryTransaction(entry, "charge"), "charge")
                                  }
                                >
                                  Charge PDF
                                </button>
                                {entry.email ? (
                                  <button
                                    type="button"
                                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink"
                                    disabled={busy || saving}
                                    onClick={() =>
                                      void sendSpotLetter(entry, summaryTransaction(entry, "charge"), "charge")
                                    }
                                  >
                                    Send charge notice
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {entry.paymentAmount > 0 ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink"
                                  disabled={busy || saving}
                                  onClick={() =>
                                    void downloadSpotLetter(entry, summaryTransaction(entry, "payment"), "payment")
                                  }
                                >
                                  Receipt PDF
                                </button>
                                {entry.email ? (
                                  <button
                                    type="button"
                                    className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-ink"
                                    disabled={busy || saving}
                                    onClick={() =>
                                      void sendSpotLetter(entry, summaryTransaction(entry, "payment"), "payment")
                                    }
                                  >
                                    Send receipt
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-md border border-line px-2 py-1 text-[11px] font-bold text-muted"
                              disabled={busy || saving}
                              onClick={() => void closeEntry(entry)}
                            >
                              Close
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {transactionEntry ? (
        <section className="card space-y-3">
          <div>
            <p className="section-label mb-1">Add transaction</p>
            <p className="text-xs text-muted">
              {transactionEntry.spotId} — {transactionEntry.payerName}
              {transactionEntry.assignedAttorney ? ` · ${transactionEntry.assignedAttorney}` : ""}. Record a charge or
              payment separately; totals update on the same spot record.
            </p>
          </div>

          <TransactionKindToggle value={txnBillingKind} disabled={saving} onChange={setTxnBillingKind} />

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Service type</span>
            <select className="field" value={txnServiceType} disabled={saving} onChange={(e) => setTxnServiceType(e.target.value)}>
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {txnBillingKind === "charge" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Charge amount</span>
                <input className="field" inputMode="decimal" value={txnCharge} disabled={saving} onChange={(e) => setTxnCharge(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Charge date</span>
                <input type="date" className="field" value={txnDate} disabled={saving} onChange={(e) => setTxnDate(e.target.value)} />
              </label>
            </div>
          ) : null}

          {txnBillingKind === "payment" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment amount</span>
                <input className="field" inputMode="decimal" value={txnPayment} disabled={saving} onChange={(e) => setTxnPayment(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment method</span>
                <select className="field" value={txnMethod} disabled={saving} onChange={(e) => setTxnMethod(e.target.value)}>
                  {methods.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Payment date</span>
                <input type="date" className="field" value={txnDate} disabled={saving} onChange={(e) => setTxnDate(e.target.value)} />
              </label>
            </div>
          ) : null}

          {txnBillingKind === "retainer" ? (
            <p className="text-sm text-muted">Retainer note only — no charge or payment amount.</p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Transaction note</span>
            <input className="field" value={txnDescription} disabled={saving} onChange={(e) => setTxnDescription(e.target.value)} />
          </label>

          {txnBillingKind !== "retainer" ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={txnSendOnLetterhead}
                disabled={saving || !transactionEntry.email.trim()}
                onChange={(e) => setTxnSendOnLetterhead(e.target.checked)}
              />
              Email {txnBillingKind === "payment" ? "acknowledgment receipt" : "billing notice"} on letterhead after saving
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void submitTransaction()}>
              Save transaction
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setTransactionEntry(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TransactionKindToggle({
  value,
  onChange,
  disabled
}: {
  value: SpotBillingTransactionKind;
  onChange: (kind: SpotBillingTransactionKind) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Transaction type</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Transaction type">
        {(
          [
            ["charge", "Charge (fees / expenses)"],
            ["payment", "Payment received"],
            ["retainer", "Retainer note"]
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
              value === kind ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
            }`}
            disabled={disabled}
            onClick={() => onChange(kind)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
