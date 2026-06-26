/** Shared visual language for SOA, AR, and billing emails — Hernandez & Associates brand. */

export const FIRM_LINE = "Hernandez & Associates Law Office";
export const FIRM_NAME = "Hernandez & Associates";
export const FIRM_SUBTITLE = "Law Office";
export const FIRM_ADDRESS =
  process.env.FIRM_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_FIRM_ADDRESS?.trim() ||
  "Office address — configure FIRM_ADDRESS in .env.local";
export const FIRM_EMAIL =
  process.env.FIRM_SENDER_EMAIL?.trim() || "info@hernandezassociates.com";
export const FIRM_LANDLINE =
  process.env.FIRM_LANDLINE_PHONE?.trim() ||
  process.env.NEXT_PUBLIC_FIRM_LANDLINE_PHONE?.trim() ||
  "";
/** Mobile — override via FIRM_MOBILE_PHONE in env. */
export const FIRM_MOBILE =
  process.env.FIRM_MOBILE_PHONE?.trim() ||
  process.env.NEXT_PUBLIC_FIRM_MOBILE_PHONE?.trim() ||
  "";
export const FIRM_WEBSITE =
  process.env.FIRM_WEBSITE?.trim() ||
  process.env.NEXT_PUBLIC_FIRM_WEBSITE?.trim() ||
  "www.hernandezassociates.com";

export const BILLING_DOC_COLORS = {
  gold: "#111111",
  goldLight: "#333333",
  goldPale: "#e5e5e5",
  cream: "#ffffff",
  ink: "#0a0a0a",
  muted: "#4a4a4a",
  line: "#d4d4d4",
  headerBg: "#0a0a0a",
  white: "#ffffff"
} as const;

/** PDF-lib rgb tuples (0–1) */
export const BILLING_DOC_RGB = {
  gold: { r: 0.067, g: 0.067, b: 0.067 },
  goldLight: { r: 0.2, g: 0.2, b: 0.2 },
  goldPale: { r: 0.898, g: 0.898, b: 0.898 },
  ink: { r: 0.039, g: 0.039, b: 0.039 },
  muted: { r: 0.29, g: 0.29, b: 0.29 },
  cream: { r: 1, g: 1, b: 1 },
  line: { r: 0.831, g: 0.831, b: 0.831 },
  headerBg: { r: 0.039, g: 0.039, b: 0.039 },
  white: { r: 1, g: 1, b: 1 }
} as const;

export function formatBillingDate(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function formatBillingPeso(value: number): string {
  return `₱${(Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** WinAnsi-safe amount for pdf-lib standard fonts (no peso sign). */
export function formatBillingPesoPdf(value: number): string {
  return `PHP ${(Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
