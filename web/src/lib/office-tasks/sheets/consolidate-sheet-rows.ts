import { EVENT_HEADERS, SHEETS, TASK_HEADERS } from "@/lib/tasks-config";
import { parseSheetDateOnly } from "@/lib/office-tasks/date-only";
import {
  batchUpdateSheetValues,
  getSheetValues,
  lastRowInPrimaryColumnABlock,
  toA1Range
} from "@/lib/office-tasks/sheets/client";
import { columnIndexToLetter } from "@/lib/office-tasks/sheets/column-letter";
import { alignRowToColumnA, findSourceIdColumnOffset } from "@/lib/office-tasks/sheets/row-align";
import { isValidEventSourceId, isValidTaskSourceId } from "@/lib/office-tasks/sheets/repair-source-ids";

type ConsolidateSheetResult = {
  moved: number;
  primaryEnd: number;
  newEnd: number;
  cleared: number;
};

export type ConsolidateOfficeSheetsResult = {
  tasks: ConsolidateSheetResult;
  events: ConsolidateSheetResult;
};

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

function padRow(row: unknown[], length: number): unknown[] {
  const padded = row.slice();
  while (padded.length < length) padded.push("");
  return padded;
}

function rowIsBlank(row: unknown[]): boolean {
  return row.every((value) => value === "" || value === null || value === undefined || value === false);
}

function alignedTaskHasContent(aligned: unknown[]): boolean {
  if (isValidTaskSourceId(cell(aligned, 0))) return true;
  return Boolean(parseSheetDateOnly(aligned[2]) || cell(aligned, 5).trim() || cell(aligned, 7).trim());
}

function alignedEventHasContent(aligned: unknown[]): boolean {
  if (isValidEventSourceId(cell(aligned, 0))) return true;
  return Boolean(
    parseSheetDateOnly(aligned[2]) ||
      parseSheetDateOnly(aligned[16]) ||
      cell(aligned, 8).trim() ||
      cell(aligned, 10).trim()
  );
}

function alignTaskRow(row: unknown[]): unknown[] {
  const offset = findSourceIdColumnOffset(row, isValidTaskSourceId, TASK_HEADERS.length);
  return alignRowToColumnA(row, offset, TASK_HEADERS.length);
}

function alignEventRow(row: unknown[]): unknown[] {
  const offset = findSourceIdColumnOffset(row, isValidEventSourceId, EVENT_HEADERS.length);
  return alignRowToColumnA(row, offset, EVENT_HEADERS.length);
}

async function consolidateSheetBelowGap(
  accessToken: string,
  sheetName: string,
  headerCount: number,
  alignRow: (raw: unknown[]) => unknown[],
  rowHasContent: (aligned: unknown[]) => boolean
): Promise<ConsolidateSheetResult> {
  const endColumn = columnIndexToLetter(headerCount);
  const rows = await getSheetValues(accessToken, toA1Range(sheetName, `A2:${endColumn}`));
  const primaryEnd = await lastRowInPrimaryColumnABlock(accessToken, sheetName);

  const orphans: { sourceRow: number; aligned: unknown[] }[] = [];
  for (let index = 0; index < rows.length; index++) {
    const sheetRow = index + 2;
    if (sheetRow <= primaryEnd) continue;

    const raw = rows[index] || [];
    if (rowIsBlank(raw)) continue;

    const aligned = padRow(alignRow(raw), headerCount);
    if (!rowHasContent(aligned)) continue;

    orphans.push({ sourceRow: sheetRow, aligned });
  }

  if (!orphans.length) {
    return { moved: 0, primaryEnd, newEnd: primaryEnd, cleared: 0 };
  }

  orphans.sort((a, b) => a.sourceRow - b.sourceRow);

  const destStart = primaryEnd + 1;
  const emptyRow = new Array(headerCount).fill("");
  const updates = new Map<string, unknown[][]>();

  orphans.forEach((orphan, offset) => {
    const destRow = destStart + offset;
    updates.set(toA1Range(sheetName, `A${destRow}:${endColumn}${destRow}`), [orphan.aligned]);
    if (orphan.sourceRow !== destRow) {
      updates.set(toA1Range(sheetName, `A${orphan.sourceRow}:${endColumn}${orphan.sourceRow}`), [emptyRow]);
    }
  });

  await batchUpdateSheetValues(
    accessToken,
    Array.from(updates.entries()).map(([range, values]) => ({ range, values }))
  );

  const cleared = orphans.filter((orphan, offset) => orphan.sourceRow !== destStart + offset).length;

  return {
    moved: orphans.length,
    primaryEnd,
    newEnd: destStart + orphans.length - 1,
    cleared
  };
}

export async function consolidateOfficeSheetRows(
  accessToken: string
): Promise<ConsolidateOfficeSheetsResult> {
  const [tasks, events] = await Promise.all([
    consolidateSheetBelowGap(
      accessToken,
      SHEETS.tasks,
      TASK_HEADERS.length,
      alignTaskRow,
      alignedTaskHasContent
    ),
    consolidateSheetBelowGap(
      accessToken,
      SHEETS.events,
      EVENT_HEADERS.length,
      alignEventRow,
      alignedEventHasContent
    )
  ]);

  return { tasks, events };
}

export function formatConsolidateSummary(result: ConsolidateOfficeSheetsResult): string {
  const parts: string[] = [];
  if (result.events.moved) {
    parts.push(
      `${result.events.moved} hearing${result.events.moved === 1 ? "" : "s"}/event${result.events.moved === 1 ? "" : "s"} now rows ${result.events.primaryEnd + 1}–${result.events.newEnd} (column A)`
    );
  }
  if (result.tasks.moved) {
    parts.push(
      `${result.tasks.moved} task${result.tasks.moved === 1 ? "" : "s"} now rows ${result.tasks.primaryEnd + 1}–${result.tasks.newEnd} (column A)`
    );
  }
  if (!parts.length) {
    return "No distant rows needed moving — main lists are already contiguous in column A.";
  }
  return `Pulled up real items under your lists: ${parts.join("; ")}. Update to refresh.`;
}
