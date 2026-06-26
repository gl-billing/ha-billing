"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AmountDisplay } from "@/components/AmountDisplay";
import { resolveClientGreeting, formatClientSalutation } from "@/lib/client-greeting";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import { firmLogoPublicUrl } from "@/lib/firm-logo-url";
import { formatPeso } from "@/lib/gl-config";
import type { ClientPortalDocument, ClientPortalSnapshot } from "@/lib/client-portal-token";
import type { ClientPortalLiveData, ClientPortalMessage, ClientPortalPayment } from "@/app/api/client-portal/live/route";
import { EmptyState } from "@/components/office-tasks/PremiumUI";

export type ClientPortalPaymentInstructions = {
  payee: string;
  gcash: string;
  maya: string;
  bank: string;
};

function formatDocDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function documentLabel(doc: ClientPortalDocument): string {
  const type = doc.documentType.toUpperCase();
  if (type === "SOA") {
    return doc.documentNumber ? `Statement of Account` : "Statement of Account";
  }
  if (type === "AR") {
    return "Acknowledgment Receipt";
  }
  return doc.documentType;
}

function messageFirmHref(snapshot: ClientPortalSnapshot): string {
  const subject = encodeURIComponent(`${snapshot.caseTitle} (${snapshot.clientCode})`);
  const body = encodeURIComponent(
    `${formatClientSalutation(snapshot.preferredGreeting, snapshot.clientName)},\n\nI would like to inquire regarding my matter.\n\n`
  );
  return `mailto:${FIRM_CONTACT.email}?subject=${subject}&body=${body}`;
}

type Props = {
  token?: string;
  snapshot: ClientPortalSnapshot;
  expiresLabel: string;
  payUrl: string | null;
  paymentInstructions?: ClientPortalPaymentInstructions;
};

type PaymentTab = "gcash" | "maya" | "bank";

export function ClientPortalView({ token, snapshot, expiresLabel, payUrl, paymentInstructions: paymentInstructionsProp }: Props) {
  const [live, setLive] = useState<ClientPortalLiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentProofOpen, setPaymentProofOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [messageReceipt, setMessageReceipt] = useState<string | null>(null);
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("gcash");

  const view = live || snapshot;
  const greetingName = resolveClientGreeting(view.preferredGreeting, view.clientName);
  const lastSoaLabel = view.lastSoaDate
    ? formatDocDate(view.lastSoaDate)
    : view.lastSoaNumber || "—";

  const payments: ClientPortalPayment[] = live?.payments || [];
  const messages: ClientPortalMessage[] = live?.messages || [];
  const paymentInstructions = live?.paymentInstructions ?? paymentInstructionsProp;
  const hasBalanceDue = view.balance > 0.005;
  const livePayUrl = hasBalanceDue ? payUrl : null;
  const showPaymentConcierge = hasBalanceDue;
  const paymentMethods = paymentInstructions
    ? (
        [
          ["gcash", "GCash", paymentInstructions.gcash],
          ["maya", "Maya", paymentInstructions.maya],
          ["bank", "Bank", paymentInstructions.bank]
        ] as const
      ).filter(([, , value]) => Boolean(value))
    : [];

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch(`/api/client-portal/live?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not refresh.");
      setLive(json.snapshot as ClientPortalLiveData);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh balance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const key = `gl-portal-welcome-${view.clientCode}`;
    if (!sessionStorage.getItem(key)) {
      setWelcomeVisible(true);
      sessionStorage.setItem(key, "1");
    }
  }, [token, view.clientCode]);

  async function sendMessage(event: React.FormEvent, intent: "general" | "payment_proof" = "general") {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    setSending(true);
    setStatus(null);
    setMessageReceipt(null);
    try {
      const res = await fetch("/api/client-portal/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          message: text,
          intent,
          paymentAmount: intent === "payment_proof" ? paymentAmount.trim() : undefined,
          paymentMethod: intent === "payment_proof" ? paymentMethod.trim() : undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not send message.");
      setMessage("");
      setPaymentAmount("");
      setPaymentProofOpen(false);
      setMessageReceipt(formatDocDate(new Date().toISOString()));
      setStatus(json.message || (intent === "payment_proof" ? "Payment proof received." : "Message sent."));
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  function startPaymentProof() {
    setPaymentProofOpen(true);
    setMessage(
      `Good day.\n\nI have made a payment for my account (${view.clientCode}).\n\nAmount: \nMethod: ${paymentMethod}\nReference / transaction no.: \nDate paid: \n\nPlease confirm once posted. Thank you.`
    );
  }

  return (
    <div className="client-portal space-y-4">
      {welcomeVisible ? (
        <section className="client-portal__welcome" role="status">
          <div className="client-portal__welcome-monogram" aria-hidden>
            GL
          </div>
          <div className="client-portal__welcome-body">
            <p className="client-portal__welcome-eyebrow">Secure client portal</p>
            <h2 className="client-portal__welcome-title">Your matter file</h2>
            <p className="client-portal__welcome-text">
              View balances, download SOAs and receipts, and message our office — all through this private link.
            </p>
            <button type="button" className="btn-primary client-portal__welcome-btn" onClick={() => setWelcomeVisible(false)}>
              Enter portal →
            </button>
          </div>
        </section>
      ) : null}

      <header className="card client-portal__header">
        <div className="client-portal__header-accent" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="client-portal__logo-wrap">
              <img src={firmLogoPublicUrl()} alt="" className="client-portal__logo" width={52} height={52} />
            </div>
            <div className="min-w-0">
              <p className="client-portal__firm-name">{FIRM_CONTACT.name}</p>
              <h1 className="client-portal__greeting">Hello, {greetingName}</h1>
              {view.caseTitle ? <p className="client-portal__case">{view.caseTitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="client-portal__secure-pill">Secure link · expires {expiresLabel}</p>
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-[10px]"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? "Refreshing…" : "Refresh balance"}
            </button>
          </div>
        </div>
      </header>

      <div className="client-portal__stats grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard
          label="Balance due"
          amount={view.balance}
          loading={loading && !live}
          highlight={view.balance > 0.005}
        />
        <StatCard label="Last SOA" value={lastSoaLabel} sub={view.lastSoaNumber ? view.lastSoaNumber : undefined} />
        <StatCard label="Retainer" amount={view.retainerBalance} />
      </div>

      {showPaymentConcierge ? (
        <section className="card client-portal__concierge p-4">
          <h2 className="section-label">Payment concierge</h2>
          <p className="mt-1 text-sm text-muted">Settle your balance with the reference below.</p>
          <div className="client-portal__concierge-hero mt-3">
            <p className="client-portal__concierge-label">Amount due</p>
            <AmountDisplay value={view.balance} className="client-portal__concierge-amount text-[#8b1e1e]" hero />
            <p className="client-portal__concierge-ref">
              Reference: <strong>{view.clientCode}</strong>
            </p>
          </div>
          {paymentMethods.length ? (
            <>
              <div className="client-portal__concierge-tabs mt-4" role="tablist" aria-label="Payment method">
                {paymentMethods.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={paymentTab === id}
                    className={`client-portal__concierge-tab ${paymentTab === id ? "client-portal__concierge-tab--active" : ""}`}
                    onClick={() => setPaymentTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="client-portal__concierge-detail mt-3">
                {paymentTab === "gcash" && paymentInstructions?.gcash ? (
                  <p>
                    Send <strong>{formatPeso(view.balance)}</strong> to GCash{" "}
                    <strong className="font-mono">{paymentInstructions.gcash}</strong>
                  </p>
                ) : null}
                {paymentTab === "maya" && paymentInstructions?.maya ? (
                  <p>
                    Send <strong>{formatPeso(view.balance)}</strong> to Maya{" "}
                    <strong className="font-mono">{paymentInstructions.maya}</strong>
                  </p>
                ) : null}
                {paymentTab === "bank" && paymentInstructions?.bank ? (
                  <p className="whitespace-pre-wrap">{paymentInstructions.bank}</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="client-portal__concierge-detail mt-3 text-sm text-muted">
              Use the secure payment page below, or contact our office for payment instructions.
            </p>
          )}
          {livePayUrl ? (
            <Link href={livePayUrl} className="btn-primary client-portal__concierge-pay mt-4 block text-center">
              Open secure payment page →
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="card client-portal__documents p-4">
        <h2 className="section-label">Document vault</h2>
        {view.documents.length ? (
          <div className="client-portal__vault mt-3">
            {view.documents.map((doc, index) => (
              <article
                key={doc.logRow ? `vault-${doc.logRow}` : `vault-${index}-${doc.pdfUrl}-${doc.amount}`}
                className="client-portal__vault-card firm-hover-lift"
              >
                <div className="client-portal__vault-card-head">
                  <span className="client-portal__vault-type">{doc.documentType}</span>
                  <time className="client-portal__vault-date">{formatDocDate(doc.timestamp)}</time>
                </div>
                <h3 className="client-portal__vault-title">{documentLabel(doc)}</h3>
                {doc.documentNumber ? (
                  <p className="client-portal__vault-number">{doc.documentNumber}</p>
                ) : null}
                {doc.amount > 0.005 ? (
                  <AmountDisplay value={doc.amount} className="client-portal__vault-amount mt-1 block text-ink" />
                ) : null}
                {doc.pdfUrl ? (
                  <a
                    href={doc.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="client-portal__vault-link mt-3 inline-block"
                  >
                    Download PDF →
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState compact message="No documents on file yet." className="mt-2" />
        )}
      </section>

      <section className="card p-4">
        <h2 className="section-label">Payment history</h2>
        {payments.length ? (
          <div className="firm-ledger-table-wrap mt-3">
            <table className="firm-ledger-table w-full text-left">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Details</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={`${payment.date}-${payment.amount}-${payment.description}`} className="firm-hover-lift-row">
                    <td className="amount-serif font-semibold text-ink">{formatPeso(payment.amount)}</td>
                    <td className="text-muted">
                      {payment.description}
                      {payment.method ? ` · ${payment.method}` : ""}
                    </td>
                    <td className="whitespace-nowrap text-right text-muted">{formatDocDate(payment.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState compact message="No payments recorded yet." className="mt-2" />
        )}
      </section>

      <section className="card p-4">
        <h2 className="section-label">Message the firm</h2>
        {token ? (
          <>
            {messageReceipt ? (
              <div className="client-portal__message-receipt mt-3" role="status">
                <span className="client-portal__message-receipt-icon" aria-hidden>
                  ✓
                </span>
                <div>
                  <p className="client-portal__message-receipt-title">Message received</p>
                  <p className="client-portal__message-receipt-text">
                    Sent {messageReceipt}. We usually reply within one business day.
                  </p>
                </div>
              </div>
            ) : null}

            {messages.length ? (
              <ul className="mt-3 space-y-2">
                {messages.map((entry) => (
                  <li
                    key={`${entry.at}-${entry.text.slice(0, 24)}`}
                    className="rounded-lg border border-line bg-cream/40 px-3 py-2 text-sm"
                  >
                    <p className="text-[10px] font-bold uppercase text-muted">{formatDocDate(entry.at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{entry.text}</p>
                  </li>
                ))}
              </ul>
            ) : !messageReceipt ? (
              <p className="mt-2 text-sm text-muted">Send a message below — it goes directly to our office inbox.</p>
            ) : null}

            <form className="mt-4 space-y-2" onSubmit={(event) => void sendMessage(event, paymentProofOpen ? "payment_proof" : "general")}>
              {paymentProofOpen ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-bold text-muted">Amount paid</span>
                    <input
                      className="field-input w-full"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="e.g. 5,000"
                      disabled={sending}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-bold text-muted">Payment method</span>
                    <select
                      className="field-input w-full"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={sending}
                    >
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Bank transfer">Bank transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>
              ) : null}
              <textarea
                className="field-input min-h-[100px] w-full resize-y text-sm"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Your message…"
                maxLength={4000}
                disabled={sending}
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={sending || !message.trim()}>
                  {sending ? "Sending…" : paymentProofOpen ? "Send payment proof" : "Send message"}
                </button>
                {paymentProofOpen ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={sending}
                    onClick={() => {
                      setPaymentProofOpen(false);
                      setMessage("");
                      setPaymentAmount("");
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" disabled={sending} onClick={startPaymentProof}>
                    I made a payment
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Use Email instead to contact the firm from this preview.</p>
        )}
      </section>

      <div className="client-portal__actions grid grid-cols-1 gap-2 sm:grid-cols-3">
        {livePayUrl || payUrl ? (
          <Link href={livePayUrl || payUrl || "#"} className="btn-primary text-center">
            Pay balance
          </Link>
        ) : (
          <span className="btn-primary pointer-events-none text-center opacity-50" aria-disabled="true">
            Pay balance
          </span>
        )}

        {view.lastSoaPdfUrl ? (
          <a
            href={view.lastSoaPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary block text-center"
          >
            Download latest SOA
          </a>
        ) : (
          <span className="btn-secondary block text-center opacity-50" aria-disabled="true">
            Download latest SOA
          </span>
        )}

        <a href={messageFirmHref(view)} className="btn-secondary block text-center">
          Email instead
        </a>
      </div>

      {status ? <p className="text-center text-sm text-muted">{status}</p> : null}

      <footer className="client-portal__footer text-center text-[11px] leading-relaxed text-muted">
        <p>
          {FIRM_CONTACT.name} · {FIRM_CONTACT.tagline}
        </p>
        <p className="mt-1">
          {FIRM_CONTACT.address} · {FIRM_CONTACT.phone}
        </p>
        <p className="mt-2">Matter reference: {view.clientCode}</p>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  amount,
  loading,
  sub,
  highlight
}: {
  label: string;
  value?: string;
  amount?: number;
  loading?: boolean;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`client-portal__stat firm-hover-lift rounded-xl border p-3 text-center ${
        highlight ? "client-portal__stat--due border-gold/30 bg-gradient-to-br from-white to-[#faf6ee]" : "border-line bg-white"
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      {typeof amount === "number" ? (
        loading ? (
          <p className="mt-1 text-lg font-extrabold text-ink">…</p>
        ) : (
          <AmountDisplay
            value={amount}
            className={`mt-1 block text-lg ${highlight ? "text-[#8b1e1e]" : "text-ink"}`}
          />
        )
      ) : (
        <p className={`mt-1 text-lg font-extrabold ${highlight ? "text-[#8b1e1e]" : "text-ink"}`}>{value}</p>
      )}
      {sub ? <p className="mt-0.5 text-[10px] font-bold text-muted">{sub}</p> : null}
    </div>
  );
}
