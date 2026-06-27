import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { formatClientSalutation, resolveClientGreeting } from "@/lib/client-greeting";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailSalutationLine,
  buildFirmWarmEmailShell,
  escapeFirmEmailHtml,
  ink,
  wrapFirmClientEmailDocument
} from "@/lib/firm-email-shell";
import { FIRM_LINE } from "@/lib/billing-document-design";

export type BirthdayGreetingInput = {
  clientName: string;
  preferredGreeting?: string;
  /** Kept for API compatibility; not included in the greeting copy. */
  caseTitle?: string;
};

export function birthdayGreetingSubject(): string {
  return `Happy Birthday — warm wishes from ${FIRM_LINE}`;
}

function birthdayMessageParagraphs(input: BirthdayGreetingInput): string[] {
  const name = resolveClientGreeting(input.preferredGreeting, input.clientName);

  return [
    `Today is yours to celebrate — and we could not let the day pass without sending our warmest wishes your way.`,
    `On behalf of all of us at ${FIRM_LINE}, we wish you a truly happy birthday, ${name}. May your day be filled with joy, gentle surprises, and moments that make you smile. May the year ahead bring you good health, peace of heart, and every happiness you deserve.`,
    `Thank you for the kindness and trust you have shown our firm. We are grateful to know you, and we hold you in our thoughts on this special day.`
  ];
}

function birthdayClosingLine(): string {
  return `With heartfelt regards from everyone at ${FIRM_LINE}.`;
}

export function buildBirthdayGreetingHtml(input: BirthdayGreetingInput): string {
  const paragraphs = birthdayMessageParagraphs(input);
  const paragraphHtml = paragraphs
    .map((text) => buildFirmEmailBodyParagraph(escapeFirmEmailHtml(text), { marginBottom: 20 }))
    .join("");

  const inner =
    buildFirmEmailSalutationLine(formatClientSalutation(input.preferredGreeting, input.clientName)) +
    paragraphHtml +
    buildFirmEmailBodyParagraph(escapeFirmEmailHtml(birthdayClosingLine()), {
      marginBottom: 0,
      color: ink,
      size: 14
    });

  return buildClientEmailHtml(
    wrapFirmClientEmailDocument(
      buildFirmWarmEmailShell({
        eyebrow: "Happy Birthday",
        headline: "A note of celebration, sent with care.",
        innerHtml: inner
      })
    )
  );
}

export function buildBirthdayGreetingPlain(input: BirthdayGreetingInput): string {
  const paragraphs = birthdayMessageParagraphs(input);
  const body =
    `${formatClientSalutation(input.preferredGreeting, input.clientName)},\n\n` +
    `${paragraphs.join("\n\n")}\n\n` +
    birthdayClosingLine();

  return buildClientEmailPlain(body);
}

export function parseBirthdayMonthDay(value: unknown): { month: number; day: number } | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const serial = Math.floor(value);
    if (serial > 20000) {
      const utc = new Date(Date.UTC(1899, 11, 30 + serial));
      return { month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
    }
  }

  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }

  const slash = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }

  const parsed = new Date(`${text}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, day: parsed.getDate() };
  }

  return null;
}

/** Normalize stored birthday to `YYYY-MM-DD` for HTML date inputs (year is placeholder when unknown). */
export function birthdayToDateInputValue(value: unknown): string {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parts = parseBirthdayMonthDay(value);
  if (!parts) return "";
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `2000-${month}-${day}`;
}

export function formatBirthdayDisplay(value: unknown): string {
  const parts = parseBirthdayMonthDay(value);
  if (!parts) return "";
  const date = new Date(2000, parts.month - 1, parts.day, 12);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function isBirthdayToday(value: unknown, today = new Date()): boolean {
  const parts = parseBirthdayMonthDay(value);
  if (!parts) return false;
  return parts.month === today.getMonth() + 1 && parts.day === today.getDate();
}

export function birthdayGreetingSentYear(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const year = Number(text.slice(0, 4));
  return Number.isFinite(year) && year >= 2000 ? year : null;
}
