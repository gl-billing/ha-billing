import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import { formatClientSalutation, resolveClientGreeting } from "@/lib/client-greeting";

export type BirthdayGreetingInput = {
  clientName: string;
  preferredGreeting?: string;
  /** Kept for API compatibility; not included in the greeting copy. */
  caseTitle?: string;
};

const FIRM_LINE = "Hernandez & Associates Law Office";

const GOLD = "#8a6b2a";
const GOLD_LIGHT = "#b8913d";
const GOLD_PALE = "#e8dcc4";
const CREAM = "#faf8f4";
const INK = "#1a1612";
const MUTED = "#4a4339";
const SERIF = "Georgia,'Times New Roman',serif";

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

function birthdaySalutationHtml(input: BirthdayGreetingInput): string {
  const line = formatClientSalutation(input.preferredGreeting, input.clientName);
  return (
    `<p style="margin:0 0 24px;font-family:${SERIF};font-size:16px;line-height:1.55;color:${INK};">` +
    `${escapeHtml(line)},</p>`
  );
}

function birthdayHeaderHtml(): string {
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td align="center" style="padding:0 0 6px;">` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="72">` +
    `<tr><td style="border-top:1px solid ${GOLD_LIGHT};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `</table></td></tr>` +
    `<tr><td align="center" style="padding:6px 0 4px;font-family:${SERIF};font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${GOLD};">Happy Birthday</td></tr>` +
    `<tr><td align="center" style="padding:0 0 8px;font-family:${SERIF};font-size:18px;line-height:1;color:${GOLD_LIGHT};">&#10022;</td></tr>` +
    `<tr><td align="center" style="padding:0 0 6px;font-family:${SERIF};font-size:15px;line-height:1.55;color:${INK};font-style:italic;">A little note of celebration, sent with care.</td></tr>` +
    `<tr><td align="center" style="padding:0;">` +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="72">` +
    `<tr><td style="border-top:1px solid ${GOLD_PALE};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `</table></td></tr>` +
    `</table>`
  );
}

export function buildBirthdayGreetingHtml(input: BirthdayGreetingInput): string {
  const paragraphs = birthdayMessageParagraphs(input);
  const paragraphHtml = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 20px;font-family:${SERIF};font-size:14px;line-height:1.85;color:${MUTED};">${escapeHtml(text)}</p>`
    )
    .join("");

  const body =
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;width:100%;">` +
    `<tr><td bgcolor="${CREAM}" style="padding:36px 32px 34px;border:1px solid ${GOLD_PALE};">` +
    birthdayHeaderHtml() +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="padding:28px 0 0;">` +
    birthdaySalutationHtml(input) +
    paragraphHtml +
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">` +
    `<tr><td style="padding:8px 0 0;border-top:1px solid ${GOLD_PALE};">` +
    `<p style="margin:20px 0 0;font-family:${SERIF};font-size:14px;line-height:1.8;color:${INK};text-align:center;font-style:italic;">${escapeHtml(birthdayClosingLine())}</p>` +
    `</td></tr></table>` +
    `</td></tr></table>` +
    `</td></tr></table>`;

  return buildClientEmailHtml(
    `<div style="font-family:${SERIF};font-size:14px;line-height:1.65;color:${INK};">${body}</div>`
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
