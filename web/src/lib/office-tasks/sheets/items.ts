import { EVENT_HEADERS, SHEETS, TASK_HEADERS, TERMINAL_STATUSES } from "@/lib/tasks-config";
import { columnIndexToLetter } from "@/lib/office-tasks/sheets/column-letter";
import { alignRowToColumnA, findSourceIdColumnOffset } from "@/lib/office-tasks/sheets/row-align";
import { isValidEventSourceId, isValidTaskSourceId } from "@/lib/office-tasks/sheets/repair-source-ids";
import {
  normalizeOfficeStatus,
  parseSheetDateOnly
} from "@/lib/office-tasks/date-only";
import { resolveEffectiveStatus } from "@/lib/office-tasks/follow-up-marker";
import { parsePleadingCaseNature } from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  batchGetSheetValues,
  batchGetSheetValuesFormatted,
  toA1Range
} from "@/lib/office-tasks/sheets/client";

export type { OfficeItem, TodayCounts } from "@/lib/office-tasks/item-types";
export { computeTodayCounts, filterTodayLists } from "@/lib/office-tasks/today-lists";

function isBlank(value: unknown): boolean {
  return value === "" || value === null || value === undefined || value === false;
}

function rowBlank(row: unknown[]): boolean {
  return row.every(isBlank);
}

function parseLastUpdatedCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return parseSheetDateOnly(value);
}

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

function boolCell(row: unknown[], index: number): boolean {
  const v = row[index];
  return v === true || String(v).toUpperCase() === "TRUE";
}

/** Keep column indices aligned when Sheets omits trailing empty cells. */
function padRow(row: unknown[], length: number): unknown[] {
  const padded = row.slice();
  while (padded.length < length) padded.push("");
  return padded;
}

function alignTaskRow(row: unknown[]): unknown[] {
  const offset = findSourceIdColumnOffset(row, isValidTaskSourceId, TASK_HEADERS.length);
  return alignRowToColumnA(row, offset, TASK_HEADERS.length);
}

function alignEventRow(row: unknown[]): unknown[] {
  const offset = findSourceIdColumnOffset(row, isValidEventSourceId, EVENT_HEADERS.length);
  return alignRowToColumnA(row, offset, EVENT_HEADERS.length);
}

function taskRowHasContent(cells: unknown[]): boolean {
  if (isValidTaskSourceId(cell(cells, 0))) return true;
  return Boolean(parseSheetDateOnly(cells[2]) || cell(cells, 5).trim() || cell(cells, 7).trim());
}

function eventRowHasContent(cells: unknown[]): boolean {
  if (isValidEventSourceId(cell(cells, 0))) return true;
  return Boolean(
    parseSheetDateOnly(cells[2]) ||
      parseSheetDateOnly(cells[16]) ||
      cell(cells, 8).trim() ||
      cell(cells, 10).trim()
  );
}

/** Filing events — primary due date is Submission / Filing Deadline (matches filing-confirmation). */
function isFilingPrimaryCategory(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === "deadline" || key === "submission" || key === "court filing";
}

function eventPrimaryDate(
  category: string,
  eventDate: string | null,
  filing: string | null,
  dateLogged: string | null
): string | null {
  if (filing && isFilingPrimaryCategory(category)) {
    return filing;
  }
  if (eventDate || filing) return eventDate || filing;
  return dateLogged;
}

export async function collectAllItems(accessToken: string): Promise<OfficeItem[]> {
  const taskRange = toA1Range(SHEETS.tasks, `A2:${columnIndexToLetter(TASK_HEADERS.length)}`);
  const eventRange = toA1Range(SHEETS.events, `A2:${columnIndexToLetter(EVENT_HEADERS.length)}`);
  const eventDatesFormattedRange = toA1Range(SHEETS.events, "B2:Q");
  const [[taskRows, eventRows], [eventDatesFormatted]] = await Promise.all([
    batchGetSheetValues(accessToken, [taskRange, eventRange]),
    batchGetSheetValuesFormatted(accessToken, [eventDatesFormattedRange])
  ]);
  return [...parseTaskRows(taskRows), ...parseEventRows(eventRows, eventDatesFormatted)];
}

function parseTaskRows(rows: string[][]): OfficeItem[] {
  const items: OfficeItem[] = [];

  rows.forEach((row, index) => {
    const cells = padRow(alignTaskRow(row), TASK_HEADERS.length);
    if (rowBlank(cells) || !taskRowHasContent(cells)) return;
    const rawStatus = normalizeOfficeStatus(cell(cells, 10));
    const remarks = cell(cells, 13);
    const done = boolCell(cells, 11) || rawStatus === "Done";
    const status = resolveEffectiveStatus(rawStatus, remarks, done);
    items.push({
      source: "Task",
      sheetName: SHEETS.tasks,
      rowNumber: index + 2,
      id: cell(cells, 0),
      date: parseSheetDateOnly(cells[2]),
      eventDate: null,
      filingDeadline: null,
      startTime: cell(cells, 18) || null,
      endTime: null,
      category: cell(cells, 6) || "Task",
      priority: cell(cells, 3),
      assignedTo: cell(cells, 4),
      clientCase: cell(cells, 5),
      venue: cell(cells, 19),
      details: cell(cells, 7),
      previousAction: cell(cells, 8),
      nextAction: cell(cells, 9),
      status,
      done,
      completedDate: parseSheetDateOnly(cells[12]),
      remarks,
      reminderDays: Number(String(cells[14] ?? "").replace(/,/g, "")) || 1,
      calendarSync: boolCell(cells, 15),
      calendarEventId: cell(cells, 16),
      lastUpdated: parseLastUpdatedCell(cells[17]),
      platform: "",
      filingMode: "",
      pleadingType: "",
      pleadingCaseNature: "",
      receivedDate: null,
      periodToFileDays: 0,
      filingDate: null
    });
  });

  return items;
}

function parseEventDateCell(raw: unknown, formatted: unknown): string | null {
  return parseSheetDateOnly(raw) || parseSheetDateOnly(formatted);
}

function parseEventRows(rows: string[][], formattedDateRows: string[][] = []): OfficeItem[] {
  const items: OfficeItem[] = [];

  rows.forEach((row, index) => {
    const cells = padRow(alignEventRow(row), EVENT_HEADERS.length);
    if (rowBlank(cells) || !eventRowHasContent(cells)) return;
    const rawStatus = normalizeOfficeStatus(cell(cells, 13));
    const remarks = cell(cells, 17);
    const done = boolCell(cells, 14) || rawStatus === "Done" || rawStatus === "Submitted";
    const status = resolveEffectiveStatus(rawStatus, remarks, done);
    const formatted = padRow(formattedDateRows[index] || [], 16);
    const dateLogged = parseEventDateCell(cells[1], formatted[0]);
    const eventDate = parseEventDateCell(cells[2], formatted[1]);
    const filing = parseEventDateCell(cells[16], formatted[15]);
    const category = cell(cells, 5) || "Event";
    items.push({
      source: "Event",
      sheetName: SHEETS.events,
      rowNumber: index + 2,
      id: cell(cells, 0),
      date: eventPrimaryDate(category, eventDate, filing, dateLogged),
      eventDate,
      filingDeadline: filing,
      startTime: cell(cells, 3) || null,
      endTime: cell(cells, 4) || null,
      category,
      priority: cell(cells, 6),
      assignedTo: cell(cells, 7),
      clientCase: cell(cells, 8),
      venue: cell(cells, 9),
      details: cell(cells, 10),
      previousAction: cell(cells, 11),
      nextAction: cell(cells, 12),
      status,
      done,
      completedDate: parseSheetDateOnly(cells[15]),
      remarks,
      reminderDays: Number(String(cells[18] ?? "").replace(/,/g, "")) || 1,
      calendarSync: boolCell(cells, 19),
      calendarEventId: cell(cells, 20),
      lastUpdated: parseLastUpdatedCell(cells[21]),
      platform: cell(cells, 22),
      filingMode: cell(cells, 23),
      pleadingType: cell(cells, 24),
      pleadingCaseNature: parsePleadingCaseNature(remarks),
      receivedDate: parseSheetDateOnly(cells[25]),
      periodToFileDays: Number(String(cells[26] ?? "").replace(/,/g, "")) || 0,
      filingDate: parseSheetDateOnly(cells[27])
    });
  });

  return items;
}

export function searchItems(items: OfficeItem[], query: string, limit = 50): OfficeItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return items
    .filter((item) => {
      const haystack = [
        item.source,
        item.id,
        item.clientCase,
        item.assignedTo,
        item.category,
        item.priority,
        item.venue,
        item.platform,
        item.filingMode,
        item.pleadingType,
        item.pleadingCaseNature,
        item.filingDate,
        item.details,
        item.previousAction,
        item.nextAction,
        item.status,
        item.remarks
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
}

function columnLetter(count: number): string {
  let n = count;
  let letter = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - rem - 1) / 26);
  }
  return letter;
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status.trim());
}
