import { createHmac, timingSafeEqual } from "crypto";
import { formatClientSalutation, formatClientSalutationHtml } from "@/lib/client-greeting";
import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { formatPeso } from "@/lib/gl-config";
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

export type ClientPortalDocument = {
  logRow?: number;
  documentType: string;
  documentNumber: string;
  timestamp: string;
  pdfUrl: string;
  amount: number;
};

export type ClientPortalSnapshot = {
  clientCode: string;
  clientName: string;
  caseTitle: string;
  balance: number;
  retainerBalance: number;
  preferredGreeting?: string;
  lastSoaDate?: string;
  lastSoaNumber?: string;
  lastSoaPdfUrl?: string;
  documents: ClientPortalDocument[];
};

export type ClientPortalPayload = {
  clientCode: string;
  exp: number;
  snapshot: ClientPortalSnapshot;
};

function secret(): string {
  const value =
    process.env.CLIENT_PORTAL_SECRET?.trim() ||
    process.env.PAYMENT_LINK_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  if (!value) {
    throw new Error("CLIENT_PORTAL_SECRET, PAYMENT_LINK_SECRET, or NEXTAUTH_SECRET is required for client portal links.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createClientPortalToken(
  snapshot: ClientPortalSnapshot,
  options?: { expiresInDays?: number }
): string {
  const exp = Math.floor(Date.now() / 1000) + (options?.expiresInDays ?? 7) * 86_400;
  const data: ClientPortalPayload = {
    clientCode: snapshot.clientCode,
    exp,
    snapshot
  };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyClientPortalToken(token: string): ClientPortalPayload | null {
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
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ClientPortalPayload;
    if (!data.clientCode || !data.snapshot?.clientName) return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildClientPortalUrl(token: string, baseUrl?: string): string {
  const root = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${root}/client/${encodeURIComponent(token)}`;
}

export function formatPortalExpiry(exp: number): string {
  return new Date(exp * 1000).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function buildClientPortalEmailPreview(
  snapshot: ClientPortalSnapshot,
  link: string,
  expiresLabel: string
): { subject: string; body: string; html: string } {
  const subject = `Your client portal — ${snapshot.clientName} (${snapshot.clientCode})`;
  const bodyPlain = `${formatClientSalutation(snapshot.preferredGreeting, snapshot.clientName)},

Good day.

You may view your account balance, recent statements, and payment instructions through our secure client portal:

${link}

This link expires on ${expiresLabel}. Please do not share it with others.

Thank you.`;

  const bodyHtml = buildFirmFormalEmailShell({
    sectionLabel: "Client portal",
    documentTitle: "Secure account access",
    innerHtml:
      formatClientSalutationHtml(snapshot.preferredGreeting, snapshot.clientName, escapeFirmEmailHtml) +
      buildFirmEmailGreetingLine() +
      buildFirmEmailBodyParagraph(
        "You may view your account balance, recent statements, and payment instructions through our secure client portal."
      ) +
      buildFirmEmailCtaButton(link, "Open client portal") +
      buildFirmEmailDetailsTable([
        { label: "Balance due", value: formatPeso(snapshot.balance) },
        { label: "Link expires", value: expiresLabel }
      ]) +
      buildFirmEmailBodyParagraph("Please do not share this link with others.", { marginBottom: 0 }) +
      buildFirmEmailClosingLine()
  });

  return {
    subject,
    body: buildClientEmailPlain(bodyPlain),
    html: buildClientEmailHtml(wrapFirmClientEmailDocument(bodyHtml))
  };
}
