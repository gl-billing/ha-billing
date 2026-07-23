"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrustLedgerEntry, TrustLedgerEntryType, TrustLedgerSummary } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { LedgerEntryText } from "@/components/LedgerEntryText";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { Skeleton } from "@/components/Skeleton";

type Props = {
  busy?: boolean;
  onNotify?: (message: string, isError?: boolean) => void;
};

export function TrustLedgerPanel({ busy, onNotify }: Props) {
  const [entries, setEntries] = useState<TrustLedgerEntry[]>([]);
  const [summary, setSummary] = useState<TrustLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [type, setType] = useState<TrustLedgerEntryType>("Deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trust-ledger");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load trust ledger.");
      setEntries(json.entries || []);
      setSummary(json.summary || null);
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "Failed to load trust ledger.", true);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!clientCode.trim() || !clientName.trim() || !amount.trim()) {
      onNotify?.("Client code, name, and amount are required.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/trust-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: clientCode.trim().toUpperCase(),
          clientName: clientName.trim(),
          type,
          amount: Number(amount.replace(/,/g, "")),
          description: description.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save trust entry.");
      onNotify?.("Trust entry recorded.");
      setAmount("");
      setDescription("");
      await load();
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "Failed to save trust entry.", true);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !entries.length) {
    return <Skeleton lines={5} />;
  }

  return (
    <div className="space-y-3">
      {summary ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-[#f5f3ef] p-2 text-center">
            <p className="text-[10px] font-bold uppercase text-muted">Trust held</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{formatPeso(summary.totalHeld)}</p>
          </div>
          <div className="rounded-md bg-[#f5f3ef] p-2 text-center">
            <p className="text-[10px] font-bold uppercase text-muted">Clients</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{summary.clientCount}</p>
          </div>
          <div className="rounded-md bg-[#f5f3ef] p-2 text-center">
            <p className="text-[10px] font-bold uppercase text-muted">Entries</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{summary.entryCount}</p>
          </div>
        </div>
      ) : null}

      <form className="rounded-lg border border-line/60 bg-[#faf9f7] p-3" onSubmit={(e) => void saveEntry(e)}>
        <p className="section-label !mb-2">Record trust movement</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field-input" placeholder="Client code" value={clientCode} disabled={busy || saving} onChange={(e) => setClientCode(e.target.value)} />
          <input className="field-input" placeholder="Client name" value={clientName} disabled={busy || saving} onChange={(e) => setClientName(e.target.value)} />
          <select className="field-input" value={type} disabled={busy || saving} onChange={(e) => setType(e.target.value as TrustLedgerEntryType)}>
            <option value="Deposit">Deposit</option>
            <option value="Disbursement">Disbursement</option>
            <option value="Transfer">Transfer</option>
          </select>
          <input className="field-input" placeholder="Amount" value={amount} disabled={busy || saving} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <input className="field-input mt-2 w-full" placeholder="Description" value={description} disabled={busy || saving} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="btn-gold mt-2 text-xs" disabled={busy || saving}>
          {saving ? "Saving…" : "Post to Trust Log"}
        </button>
      </form>

      {!entries.length ? (
        <EmptyState message="No trust ledger entries yet. Record client fund deposits here." />
      ) : (
        <div className="firm-ledger-table-wrap max-h-80 overflow-y-auto">
          <table className="firm-ledger-table w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
                <th>Description</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.sheetRow}>
                  <td data-label="Date">{entry.date}</td>
                  <td data-label="Client">
                    <strong>{entry.clientCode}</strong> · {entry.clientName}
                  </td>
                  <td data-label="Type">{entry.type}</td>
                  <td className="amount-serif text-right" data-label="Amount">
                    {formatPeso(entry.amount)}
                  </td>
                  <td className="amount-serif text-right font-semibold" data-label="Balance">
                    {formatPeso(entry.balance)}
                  </td>
                  <td className="text-muted" data-label="Description">
                    <LedgerEntryText
                      entry={{
                        type: entry.type as "charge" | "payment",
                        category: "",
                        description: entry.description,
                        details: ""
                      }}
                      variant="label-only"
                    />
                  </td>
                  <td className="text-muted" data-label="Recorded by">
                    {entry.recordedBy || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
