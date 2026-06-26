/**
 * Philippine regular holidays (fixed + computed movable dates).
 * Movable Islamic dates use official proclamation years when known; verify annually.
 * Source baseline: Proclamation No. 1006, s. 2025 (2026) + later Eid proclamations.
 */

export type PhilippineRegularHoliday = {
  date: string;
  name: string;
};

/** Official Eid regular-holiday dates by year (from Presidential Proclamations). */
const EID_REGULAR_BY_YEAR: Record<number, PhilippineRegularHoliday[]> = {
  2024: [
    { date: "2024-04-10", name: "Eid'l Fitr" },
    { date: "2024-06-17", name: "Eid'l Adha" }
  ],
  2025: [
    { date: "2025-03-31", name: "Eid'l Fitr" },
    { date: "2025-06-07", name: "Eid'l Adha" }
  ],
  2026: [{ date: "2026-03-20", name: "Eid'l Fitr" }],
  2027: [
    { date: "2027-03-10", name: "Eid'l Fitr" },
    { date: "2027-05-17", name: "Eid'l Adha" }
  ],
  2028: [
    { date: "2028-02-27", name: "Eid'l Fitr" },
    { date: "2028-05-06", name: "Eid'l Adha" }
  ],
  2029: [
    { date: "2029-02-15", name: "Eid'l Fitr" },
    { date: "2029-04-25", name: "Eid'l Adha" }
  ],
  2030: [
    { date: "2030-02-05", name: "Eid'l Fitr" },
    { date: "2030-04-14", name: "Eid'l Adha" }
  ]
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Gregorian Easter Sunday (Anonymous algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysFromDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function lastMondayOfAugust(year: number): string {
  const d = new Date(year, 7, 31);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return toYmd(year, 8, d.getDate());
}

export function getPhilippineRegularHolidays(year: number): PhilippineRegularHoliday[] {
  const easter = easterSunday(year);
  const list: PhilippineRegularHoliday[] = [
    { date: toYmd(year, 1, 1), name: "New Year's Day" },
    { date: addDaysFromDate(easter, -3), name: "Maundy Thursday" },
    { date: addDaysFromDate(easter, -2), name: "Good Friday" },
    { date: toYmd(year, 4, 9), name: "Araw ng Kagitingan" },
    { date: toYmd(year, 5, 1), name: "Labor Day" },
    { date: toYmd(year, 6, 12), name: "Independence Day" },
    { date: lastMondayOfAugust(year), name: "National Heroes Day" },
    { date: toYmd(year, 11, 30), name: "Bonifacio Day" },
    { date: toYmd(year, 12, 25), name: "Christmas Day" },
    { date: toYmd(year, 12, 30), name: "Rizal Day" }
  ];

  const eid = EID_REGULAR_BY_YEAR[year] || [];
  list.push(...eid);

  const byDate = new Map<string, PhilippineRegularHoliday>();
  for (const h of list) {
    byDate.set(h.date, h);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getPhilippineRegularHolidayMap(year: number): Map<string, string> {
  return new Map(getPhilippineRegularHolidays(year).map((h) => [h.date, h.name]));
}

export function getPhilippineRegularHoliday(ymd: string): string | undefined {
  const year = Number(ymd.slice(0, 4));
  if (!Number.isFinite(year)) return undefined;
  return getPhilippineRegularHolidayMap(year).get(ymd);
}

/** Short label for cramped calendar cells. */
export function shortPhilippineHolidayLabel(name: string, max = 22): string {
  const upper = name.toUpperCase();
  if (upper.length <= max) return upper;
  if (upper.includes("EID")) return upper.includes("FITR") ? "EID'L FITR" : "EID'L ADHA";
  if (upper.includes("MAUNDY")) return "MAUNDY THU";
  if (upper.includes("KAGITINGAN")) return "DAY OF VALOR";
  if (upper.includes("HEROES")) return "NATIONAL HEROES";
  return `${upper.slice(0, max - 1)}…`;
}
