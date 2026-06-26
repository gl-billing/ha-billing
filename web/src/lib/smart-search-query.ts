import { todayYmd, getMondayOfWeekYmd, getWeekDatesYmd } from "@/lib/office-tasks/date-only";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { itemHasAssignee } from "@/lib/office-tasks/schedule";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

const TYPE_PATTERNS: { re: RegExp; source: "Task" | "Event" }[] = [
  { re: /\bhearings?\b/i, source: "Event" },
  { re: /\bevents?\b/i, source: "Event" },
  { re: /\bdeadlines?\b/i, source: "Event" },
  { re: /\btasks?\b/i, source: "Task" }
];

const TITLE_PREFIX = /^(?:atty\.?|attorney|mr\.?|ms\.?|mrs\.?)\s+/i;

export type SmartSearchIntent = {
  assignee: string | null;
  source: "Task" | "Event" | null;
  dateFrom: string | null;
  dateTo: string | null;
  keywords: string;
  /** True when assignee, type, or date was extracted from natural language. */
  parsed: boolean;
};

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripMatched(text: string, match: RegExpMatchArray | null): string {
  if (!match || match.index === undefined) return text;
  return normalizeSpace(text.slice(0, match.index) + text.slice(match.index + match[0].length));
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
}

function defaultYear(month: number, today: string): number {
  const y = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  if (month < currentMonth) return y + 1;
  return y;
}

function normalizePersonToken(text: string): string {
  return normalizeSpace(text.replace(TITLE_PREFIX, "").replace(/['']s$/i, ""));
}

function resolveAssignee(query: string, roster: string[]): string | null {
  if (!roster.length) return null;
  const q = query.toLowerCase();

  const possessive = query.match(/([a-z][a-z.\s'-]{1,40})['']s\b/i);
  if (possessive) {
    const fragment = normalizePersonToken(possessive[1]).toLowerCase();
    if (fragment.length >= 3) {
      const hit = roster.find((name) => name.toLowerCase().includes(fragment));
      if (hit) return hit;
    }
  }

  const sorted = [...roster].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const norm = name.toLowerCase().replace(TITLE_PREFIX, "");
    if (norm.length >= 4 && q.includes(norm)) return name;
    const parts = norm.split(/\s+/).filter((p) => p.length >= 2);
    if (parts.length >= 2 && parts.every((p) => q.includes(p))) return name;
    if (parts.length >= 3) {
      const withoutLast = parts.slice(0, -1);
      if (withoutLast.length >= 2 && withoutLast.every((p) => q.includes(p))) return name;
    }
    if (parts.length >= 2) {
      const lead = parts.slice(0, 2).join(" ");
      if (lead.length >= 5 && q.includes(lead)) return name;
    }
    const last = parts[parts.length - 1];
    if (last && last.length >= 4 && q.includes(last)) return name;
  }

  return null;
}

function parseDateRange(
  query: string,
  today: string
): { from: string | null; to: string | null; remainder: string } {
  let text = ` ${query.toLowerCase()} `;
  let from: string | null = null;
  let to: string | null = null;

  const todayMatch = text.match(/\btoday\b/);
  if (todayMatch) {
    from = today;
    to = today;
    text = text.replace(/\btoday\b/g, " ");
  }

  const weekMatch = text.match(/\bthis week\b/);
  if (weekMatch) {
    const start = getMondayOfWeekYmd(today);
    const dates = getWeekDatesYmd(start);
    from = dates[0];
    to = dates[dates.length - 1];
    text = text.replace(/\bthis week\b/g, " ");
  }

  const dayMonthMatch = text.match(
    /\b(?:for|in|on)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/
  );
  if (dayMonthMatch) {
    const month = MONTHS[dayMonthMatch[1].toLowerCase()];
    const day = Number(dayMonthMatch[2]);
    const year = dayMonthMatch[3] ? Number(dayMonthMatch[3]) : defaultYear(month, today);
    const single = ymd(year, month, day);
    from = single;
    to = single;
    text = text.replace(dayMonthMatch[0], " ");
  }

  const monthDayMatch = text.match(
    /\b(?:for|in|on)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/
  );
  if (monthDayMatch) {
    const day = Number(monthDayMatch[1]);
    const month = MONTHS[monthDayMatch[2].toLowerCase()];
    const year = monthDayMatch[3] ? Number(monthDayMatch[3]) : defaultYear(month, today);
    const single = ymd(year, month, day);
    from = single;
    to = single;
    text = text.replace(monthDayMatch[0], " ");
  }

  const monthMatch = text.match(
    /\b(?:for|in|on)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?!\s+\d{1,2}\b)(?:\s+(\d{4}))?/
  );
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].toLowerCase()];
    const year = monthMatch[2] ? Number(monthMatch[2]) : defaultYear(month, today);
    from = ymd(year, month, 1);
    to = ymd(year, month, lastDayOfMonth(year, month));
    text = text.replace(monthMatch[0], " ");
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    from = isoMatch[1];
    to = isoMatch[1];
    text = text.replace(isoMatch[0], " ");
  }

  return { from, to, remainder: normalizeSpace(text) };
}

export function parseSmartSearchQuery(
  query: string,
  roster: string[] = [],
  today = todayYmd()
): SmartSearchIntent {
  const raw = normalizeSpace(query);
  if (!raw) {
    return {
      assignee: null,
      source: null,
      dateFrom: null,
      dateTo: null,
      keywords: "",
      parsed: false
    };
  }

  let text = raw.toLowerCase();
  let source: "Task" | "Event" | null = null;

  for (const pattern of TYPE_PATTERNS) {
    const match = text.match(pattern.re);
    if (match) {
      source = pattern.source;
      text = stripMatched(text, match);
      break;
    }
  }

  const date = parseDateRange(text, today);
  text = date.remainder;
  let assignee = resolveAssignee(text, roster);
  if (assignee) {
    const fragments = [
      assignee.toLowerCase(),
      ...assignee.toLowerCase().split(/\s+/),
      normalizePersonToken(assignee).toLowerCase()
    ];
    for (const fragment of fragments) {
      if (fragment.length >= 3) {
        text = text.replace(new RegExp(`\\b${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
      }
    }
    text = text.replace(/['']s\b/gi, " ");
  }

  text = normalizeSpace(
    text
      .replace(/\bfor\b/gi, " ")
      .replace(/\bin\b/gi, " ")
      .replace(/\bon\b/gi, " ")
      .replace(/\bof\b/gi, " ")
      .replace(TITLE_PREFIX, "")
  );

  const parsed = Boolean(assignee || source || date.from || date.to);

  return {
    assignee,
    source,
    dateFrom: date.from,
    dateTo: date.to,
    keywords: text,
    parsed
  };
}

function itemDates(item: OfficeItem): string[] {
  return [item.date, item.eventDate, item.filingDeadline].filter((d): d is string => Boolean(d));
}

function itemMatchesDate(item: OfficeItem, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const dates = itemDates(item);
  if (!dates.length) return false;
  return dates.some((d) => {
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function itemMatchesKeywords(item: OfficeItem, keywords: string): boolean {
  const q = keywords.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.id,
    item.clientCase,
    item.assignedTo,
    item.category,
    item.priority,
    item.venue,
    item.details,
    item.previousAction,
    item.nextAction,
    item.status,
    item.remarks
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => token.length < 2 || haystack.includes(token));
}

export function filterItemsBySmartIntent(
  items: OfficeItem[],
  intent: SmartSearchIntent,
  roster: string[] = []
): OfficeItem[] {
  if (!intent.parsed && !intent.keywords.trim()) return [];

  return items.filter((item) => {
    if (intent.source && item.source !== intent.source) return false;
    if (intent.assignee && !itemHasAssignee(item, intent.assignee, roster)) return false;
    if (!itemMatchesDate(item, intent.dateFrom, intent.dateTo)) return false;
    if (!itemMatchesKeywords(item, intent.keywords)) return false;
    return true;
  });
}

export function formatSmartSearchLabel(intent: SmartSearchIntent): string | null {
  if (!intent.parsed) return null;
  const parts: string[] = [];
  if (intent.assignee) parts.push(intent.assignee);
  if (intent.source === "Event") parts.push("Hearings / events");
  if (intent.source === "Task") parts.push("Tasks");
  if (intent.dateFrom && intent.dateTo) {
    if (intent.dateFrom === intent.dateTo) {
      parts.push(
        new Date(`${intent.dateFrom}T12:00:00Z`).toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
        })
      );
    } else if (intent.dateFrom.endsWith("-01") && intent.dateTo.slice(0, 7) === intent.dateFrom.slice(0, 7)) {
      parts.push(
        new Date(`${intent.dateFrom}T12:00:00Z`).toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
          timeZone: "UTC"
        })
      );
    } else {
      parts.push(`${intent.dateFrom} – ${intent.dateTo}`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Hook for a future LLM parser — swap implementation without changing callers. */
export type SmartSearchParser = (query: string, roster: string[]) => SmartSearchIntent;

export const parseSmartSearch: SmartSearchParser = parseSmartSearchQuery;
