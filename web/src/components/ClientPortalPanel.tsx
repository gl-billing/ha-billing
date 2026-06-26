"use client";

import { useEffect, useState } from "react";
import { ClientPortalView, type ClientPortalPaymentInstructions } from "@/components/ClientPortalView";
import type { ClientPortalSnapshot } from "@/lib/client-portal-token";
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

export function ClientPortalPanel({ clientCode, clientName, balance, email, busy, onStatus }: Props) {
  const [sendEmail, setSendEmail] = useState(Boolean(email));
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [previewSnapshot, setPreviewSnapshot] = useState<ClientPortalSnapshot | null>(null);
  const [previewPayUrl, setPreviewPayUrl] = useState<string | null>(null);
  const [previewPaymentInstructions, setPreviewPaymentInstructions] =
    useState<ClientPortalPaymentInstructions | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setSendEmail(Boolean(email));
    setLink("");
    setExpiresAt("");
    setPreviewSnapshot(null);
    setPreviewPayUrl(null);
    setPreviewPaymentInstructions(null);
    setShowPreview(false);
    setWorking(false);
  }, [clientCode, email]);

  async function createLink() {
    setWorking(true);
    try {
      const res = await fetch("/api/client-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode,
          sendEmail,
          recipientEmail: email,
          expiresInDays: 7
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create client portal link.");
      setLink(json.link || "");
      setExpiresAt(json.expiresAt || "");
      setPreviewSnapshot(json.snapshot || null);
      setPreviewPayUrl(json.payUrl || null);
      setPreviewPaymentInstructions(json.paymentInstructions || null);
      setShowPreview(true);
      onStatus(json.message || "Client portal link ready.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to create client portal link.", true);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="card min-w-0 overflow-hidden">
      <p className="section-label">Client portal</p>
      <p className="mb-2 text-xs text-muted">
        Send {clientName} a secure read-only link to view balance ({formatPeso(balance)}), SOA/receipts, and pay —
        no Google login required. Link expires in 7 days.
        {balance <= 0.005 ? (
          <>
            {" "}
            <strong className="text-ink">Payment concierge</strong> appears on the portal only when this client has a
            balance due.
          </>
        ) : null}
      </p>
      {email ? (
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sendEmail} disabled={busy || working} onChange={(e) => setSendEmail(e.target.checked)} />
          Email portal link to {email}
        </label>
      ) : (
        <p className="mb-3 text-xs text-amber-900">Add a contact email on the client record to email the link directly.</p>
      )}
      <button type="button" className="btn-gold text-xs" disabled={busy || working} onClick={() => void createLink()}>
        Create client portal link
      </button>
      {link ? (
        <div className="secure-link-box">
          {expiresAt ? <p className="text-muted">Expires {expiresAt}</p> : null}
          <a className="secure-link-display" href={link} title={link} target="_blank" rel="noreferrer">
            {truncateLinkForDisplay(link)}
          </a>
        </div>
      ) : null}

      {previewSnapshot && link ? (
        <div className="client-portal-preview mt-4">
          <button
            type="button"
            className="client-portal-preview__toggle text-xs font-bold text-gold-dark underline"
            onClick={() => setShowPreview((open) => !open)}
          >
            {showPreview ? "Hide client preview" : "Preview client view"}
          </button>
          {showPreview ? (
            <div className="client-portal-preview__frame mt-3">
              <ClientPortalView
                snapshot={previewSnapshot}
                expiresLabel={expiresAt || "7 days"}
                payUrl={previewPayUrl}
                paymentInstructions={previewPaymentInstructions || undefined}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
