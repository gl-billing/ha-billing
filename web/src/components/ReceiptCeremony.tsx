"use client";

import { AmountDisplay } from "@/components/AmountDisplay";

type CeremonyKind = "ar" | "soa";

type Props = {
  kind?: CeremonyKind;
  receiptNumber: string;
  amount?: number;
  eyebrow?: string;
  subtitle?: string;
  onDismiss?: () => void;
};

const COPY: Record<
  CeremonyKind,
  { seal: string; eyebrow: string; defaultSubtitle: string }
> = {
  ar: {
    seal: "AR",
    eyebrow: "Acknowledgment receipt issued",
    defaultSubtitle: "PDF saved to the client folder and logged in the document trail."
  },
  soa: {
    seal: "SOA",
    eyebrow: "Statement of account issued",
    defaultSubtitle: "PDF saved to the client folder and emailed to the client."
  }
};

/** Brief success moment after an AR or SOA is issued. */
export function ReceiptCeremony({
  kind = "ar",
  receiptNumber,
  amount,
  eyebrow,
  subtitle,
  onDismiss
}: Props) {
  const copy = COPY[kind];
  return (
    <section className="receipt-ceremony" role="status">
      <div className="receipt-ceremony__seal" aria-hidden>
        {copy.seal}
      </div>
      <div className="receipt-ceremony__body">
        <p className="receipt-ceremony__eyebrow">{eyebrow || copy.eyebrow}</p>
        <p className="receipt-ceremony__number amount-serif">{receiptNumber}</p>
        {typeof amount === "number" && amount > 0.005 ? (
          <p className="receipt-ceremony__amount">
            <AmountDisplay value={amount} className="text-lg text-ink" />
          </p>
        ) : null}
        <p className="receipt-ceremony__text">{subtitle || copy.defaultSubtitle}</p>
        {onDismiss ? (
          <button type="button" className="btn-secondary receipt-ceremony__dismiss" onClick={onDismiss}>
            Continue
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function parseReceiptNumberFromMessage(message: string, fallback = "Receipt issued"): string {
  const explicit = message.match(/\b(AR[-\s]?[\dA-Z-]+)\b/i)?.[1];
  if (explicit) return explicit.replace(/\s+/g, "");
  const numbered = message.match(/receipt\s+(?:no\.?\s*)?([A-Z0-9-]+)/i)?.[1];
  if (numbered) return numbered;
  return fallback;
}

export function parseInvoiceNumberFromMessage(message: string, fallback = "SOA issued"): string {
  const explicit = message.match(/\b(INV[-\s]?[\dA-Z-]+)\b/i)?.[1];
  if (explicit) return explicit.replace(/\s+/g, "");
  const numbered = message.match(/(?:invoice|soa)\s+(?:no\.?\s*)?([A-Z0-9-]+)/i)?.[1];
  if (numbered) return numbered;
  return fallback;
}
