"use client";

import { useEffect, useState } from "react";
import { formatPeso } from "@/lib/gl-config";
import { truncateLinkForDisplay } from "@/lib/link-display";

type Props = {
  clientCode: string;
  clientName: string;
  balance: number;
  email?: string;
  busy: boolean;
  onStatus: (message: string, isError?: boolean) => void;
};

export function PaymentRequestPanel({ clientCode, clientName, balance, email, busy, onStatus }: Props) {
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [sendEmail, setSendEmail] = useState(Boolean(email));
  const [link, setLink] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setAmount(balance > 0 ? String(balance) : "");
    setSendEmail(Boolean(email));
    setLink("");
    setWorking(false);
  }, [clientCode, balance, email]);

  async function createLink() {
    setWorking(true);
    try {
      const res = await fetch("/api/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode,
          amount: Number(amount) || balance,
          sendEmail,
          recipientEmail: email
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create payment link.");
      setLink(json.link || "");
      onStatus(json.message || "Payment link ready.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to create payment link.", true);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="card min-w-0 overflow-hidden">
      <p className="section-label">Payment request link</p>
      <p className="mb-2 text-xs text-muted">
        Generate a secure link for {clientName} with GCash / bank instructions (no login required).
      </p>
      <label className="mb-2 block text-xs font-bold text-muted">Amount</label>
      <input
        className="field mb-2"
        type="number"
        min="0"
        step="0.01"
        value={amount}
        disabled={busy || working}
        onChange={(e) => setAmount(e.target.value)}
      />
      {email ? (
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sendEmail} disabled={busy || working} onChange={(e) => setSendEmail(e.target.checked)} />
          Email link to {email}
        </label>
      ) : null}
      <button type="button" className="btn-gold text-xs" disabled={busy || working || !amount} onClick={() => void createLink()}>
        Create payment link
      </button>
      {link ? (
        <div className="secure-link-box">
          <p className="font-bold text-ink">{formatPeso(Number(amount) || balance)}</p>
          <a className="secure-link-display" href={link} title={link} target="_blank" rel="noreferrer">
            {truncateLinkForDisplay(link)}
          </a>
        </div>
      ) : null}
    </section>
  );
}
