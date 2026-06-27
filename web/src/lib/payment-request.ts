import { createHmac, timingSafeEqual } from "crypto";
import { formatPeso } from "@/lib/gl-config";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { formatClientSalutation, formatClientSalutationHtml } from "@/lib/client-greeting";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailClosingLine,
  buildFirmEmailCtaButton,
  buildFirmEmailDetailsTable,
  buildFirmEmailGreetingLine,
  buildFirmFormalEmailShell,
  escapeFirmEmailHtml,
  wrapFirmClientEmailDocument
} from "@/lib/firm-email-shell";

export type PaymentRequestPayload = {
  clientCode: string;
  clientName: string;
  amount: number;
  caseTitle: string;
  preferredGreeting?: string;
  exp: number;
};

function secret(): string {
  const value =
    process.env.PAYMENT_LINK_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.APPS_SCRIPT_WEB_APP_SECRET?.trim();
  if (!value) throw new Error("PAYMENT_LINK_SECRET or NEXTAUTH_SECRET is required for payment links.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPaymentRequestToken(payload: Omit<PaymentRequestPayload, "exp"> & { expiresInDays?: number }): string {
  const exp =
    Math.floor(Date.now() / 1000) + (payload.expiresInDays ?? 14) * 86_400;
  const data: PaymentRequestPayload = {
    clientCode: payload.clientCode,
    clientName: payload.clientName,
    amount: payload.amount,
    caseTitle: payload.caseTitle,
    preferredGreeting: payload.preferredGreeting,
    exp
  };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifyPaymentRequestToken(token: string): PaymentRequestPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PaymentRequestPayload;
    if (!data.clientCode || !data.clientName || typeof data.amount !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildPaymentRequestUrl(token: string, baseUrl?: string): string {
  const root = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${root}/pay/${encodeURIComponent(token)}`;
}

export function getPaymentInstructions(): {
  gcash: string;
  maya: string;
  bank: string;
  payee: string;
} {
  return {
    payee: process.env.PAYMENT_PAYEE_NAME?.trim() || "Hernandez & Associates Office",
    gcash: process.env.PAYMENT_GCASH_NUMBER?.trim() || "",
    maya: process.env.PAYMENT_MAYA_NUMBER?.trim() || "",
    bank: process.env.PAYMENT_BANK_DETAILS?.trim() || ""
  };
}

export function buildPaymentRequestEmailPreview(
  payload: PaymentRequestPayload,
  link: string
): { subject: string; body: string; html: string } {
  const casePhrase = payload.caseTitle ? ` for <em>${escapeHtml(payload.caseTitle)}</em>` : "";
  const casePlain = payload.caseTitle ? ` for ${payload.caseTitle}` : "";
  const subject = `Payment request — ${payload.clientName} (${payload.clientCode})`;

  const bodyPlain = `${formatClientSalutation(payload.preferredGreeting, payload.clientName)},

Good day.

Please settle your outstanding balance of ${formatPeso(payload.amount)}${casePlain}.

You may view payment instructions and settle online through our secure payment page:

${link}

Reference: client code ${payload.clientCode}

Should you have any questions or require further clarification, please do not hesitate to contact our office.

Thank you.`;

  const bodyHtml =
    buildFirmFormalEmailShell({
      sectionLabel: "Billing",
      documentTitle: "Payment Request",
      innerHtml:
        formatClientSalutationHtml(payload.preferredGreeting, payload.clientName, escapeFirmEmailHtml) +
        buildFirmEmailGreetingLine() +
        buildFirmEmailBodyParagraph(
          `Please settle your outstanding balance of <strong>${escapeFirmEmailHtml(formatPeso(payload.amount))}</strong>${casePhrase}.`
        ) +
        buildFirmEmailBodyParagraph(
          "You may view payment instructions and settle online through our secure payment page."
        ) +
        buildFirmEmailCtaButton(link, "Open secure payment page") +
        buildFirmEmailDetailsTable([{ label: "Client reference", value: payload.clientCode }]) +
        buildFirmEmailBodyParagraph(
          "Should you have any questions or require further clarification, please do not hesitate to contact our office.",
          { marginBottom: 0 }
        ) +
        buildFirmEmailClosingLine()
    });

  return {
    subject,
    body: buildClientEmailPlain(bodyPlain),
    html: buildClientEmailHtml(wrapFirmClientEmailDocument(bodyHtml))
  };
}

/** @deprecated Use buildPaymentRequestEmailPreview */
export function formatPaymentRequestEmailHtml(payload: PaymentRequestPayload, link: string): string {
  return buildPaymentRequestEmailPreview(payload, link).html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
