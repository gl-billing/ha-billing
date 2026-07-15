/** Calendar-date helpers — always treat YYYY-MM-DD as a date, never a timestamp. */

export const OFFICE_TIMEZONE = "Asia/Manila";

export function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Store ISO dates as plain text in Sheets so reads never depend on locale serials. */
export function sheetDateCellValue(value: string): string {
  const trimmed = String(value || "").trim();
  if (!isValidYmd(trimmed)) return trimmed;
  return `'${trimmed}`;
}

/** Anchor at UTC noon so display math never crosses a day boundary. */
export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatYmdFromUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYmd(timeZone = OFFICE_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYmdFromUtcDate(d);
}

/** Whole calendar days between due date and today (positive when overdue). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = ymdToUtcDate(fromYmd).getTime();
  const to = ymdToUtcDate(toYmd).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function getMondayOfWeekYmd(anchorYmd: string): string {
  const d = ymdToUtcDate(anchorYmd);
  const weekday = d.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatYmdFromUtcDate(d);
}

export function getWeekDatesYmd(weekStartMonday: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDaysYmd(weekStartMonday, i));
  }
  return dates;
}

export function formatDisplayDate(ymd: string, style: "long" | "short" | "register" = "long"): string {
  if (style === "register") {
    return ymdToUtcDate(ymd).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }
  return ymdToUtcDate(ymd).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : undefined,
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1, 12, 0, 0)).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  });
}

export type CalendarCell = { date: string; inMonth: boolean };

export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const monthStart = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const firstDay = monthStart.getUTCDay();
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const gridStart = new Date(Date.UTC(year, month, 1 + mondayOffset, 12, 0, 0));

  const weeks: CalendarCell[][] = [];
  for (let week = 0; week < 6; week++) {
    const row: CalendarCell[] = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(gridStart);
      d.setUTCDate(gridStart.getUTCDate() + week * 7 + day);
      row.push({
        date: formatYmdFromUtcDate(d),
        inMonth: d.getUTCMonth() === month
      });
    }
    weeks.push(row);
  }
  return weeks;
}

function isSheetsDateSerial(value: number): boolean {
  return Number.isFinite(value) && value > 20000 && value < 100000;
}

/** Google Sheets serial (days since 1899-12-30) → YYYY-MM-DD. */
export function sheetsSerialToYmd(serial: number): string {
  const daySerial = Math.floor(serial);
  const utcMs = Math.round((daySerial - 25569) * 86400000);
  return formatYmdFromUtcDate(new Date(utcMs));
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

function ymdFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumericSerial(value: unknown): string | null {
  if (typeof value === "number" && isSheetsDateSerial(value)) {
    return sheetsSerialToYmd(value);
  }
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!cleaned) return null;
  const asNum = Number(cleaned);
  if (!Number.isNaN(asNum) && isSheetsDateSerial(asNum)) {
    return sheetsSerialToYmd(asNum);
  }
  return null;
}

/** Slash dates from Sheets — prefer D/M/Y (Philippines) when ambiguous. */
function parseSlashDate(first: number, second: number, year: number): string | null {
  if (first > 12) return ymdFromParts(year, second, first);
  if (second > 12) return ymdFromParts(year, first, second);
  return ymdFromParts(year, second, first);
}

function parseTextDate(text: string): string | null {
  const cleaned = text.replace(/^'+/, "").trim();
  if (isValidYmd(cleaned)) return cleaned;

  const isoPrefix = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return parseSlashDate(Number(slash[1]), Number(slash[2]), Number(slash[3]));
  }

  const dmy = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return ymdFromParts(Number(year), Number(month), Number(day));
  }

  const named = cleaned.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]*(\d{4})$/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) return ymdFromParts(Number(named[3]), month, Number(named[1]));
  }

  const namedLong = cleaned.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedLong) {
    const month = MONTHS[namedLong[1].slice(0, 3).toLowerCase()];
    if (month) return ymdFromParts(Number(namedLong[3]), month, Number(namedLong[2]));
  }

  const ms = Date.parse(cleaned);
  if (!Number.isNaN(ms)) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: OFFICE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(ms));
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  }

  return null;
}

/** Parse a Sheets cell value into YYYY-MM-DD without local timezone drift. */
export function parseSheetDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const serial = parseNumericSerial(value);
  if (serial) return serial;

  const text = String(value).trim().replace(/^'+/, "");
  if (!text) return null;

  return parseTextDate(text);
}

const STATUS_ALIASES: Record<string, string> = {
  waiting: "Waiting",
  started: "Started",
  "in progress": "In Progress",
  done: "Done",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  reset: "Reset",
  overdue: "Overdue",
  scheduled: "Scheduled",
  submitted: "Submitted"
};

/** Normalize sheet status text (trim, strip leading apostrophe, fix common casing). */
export function normalizeOfficeStatus(status: string): string {
  const trimmed = String(status || "")
    .trim()
    .replace(/^'+/, "");
  if (!trimmed) return "";
  return STATUS_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function isCancelledStatus(status: string): boolean {
  const s = normalizeOfficeStatus(status);
  return s === "Cancelled" || s === "Reset";
}

/** Past due and still needs action — excludes Waiting / Started (shown daily on Today instead). */
export function isPastDueOpenItem(
  item: { date: string | null; done: boolean; status: string },
  today: string
): boolean {
  if (item.done || !item.date || item.date >= today || isCancelledStatus(item.status)) return false;
  const s = normalizeOfficeStatus(item.status);
  if (s === "Waiting" || s === "Started") return false;
  return true;
}

export function isWaitingOrStarted(item: { done: boolean; status: string }): boolean {
  if (item.done) return false;
  const s = normalizeOfficeStatus(item.status);
  if (s === "Done" || s === "Submitted") return false;
  return s === "Waiting" || s === "Started";
}
