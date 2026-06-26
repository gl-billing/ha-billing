import { SHEETS } from "@/lib/tasks-config";
import { idMatchesClientCase } from "@/lib/office-tasks/client-matter";
import { batchGetSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { generateSourceId } from "@/lib/office-tasks/sheets/source-id";

const TASK_ID_RE = /^[A-Z]{2,3}-TASK-\d{4}$/;
const EVENT_ID_RE = /^[A-Z]{2,3}-EVT-\d{4}$/;

export function isValidTaskSourceId(id: string): boolean {
  return TASK_ID_RE.test(String(id || "").trim());
}

export function isValidEventSourceId(id: string): boolean {
  return EVENT_ID_RE.test(String(id || "").trim());
}

function isBlank(value: unknown): boolean {
  return value === "" || value === null || value === undefined || value === false;
}

function rowBlank(row: unknown[]): boolean {
  return row.every(isBlank);
}

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Fill blank or invalid Task ID / Event ID cells (e.g. dates pasted in column A). */
export async function backfillMissingSourceIds(
  accessToken: string
): Promise<{ tasks: number; events: number }> {
  const [taskRows, eventRows] = await batchGetSheetValues(accessToken, [
    toA1Range(SHEETS.tasks, "A2:F"),
    toA1Range(SHEETS.events, "A2:I")
  ]);

  const knownTaskIds = taskRows
    .map((row) => cell(row, 0))
    .filter((id) => isValidTaskSourceId(id));
  const knownEventIds = eventRows
    .map((row) => cell(row, 0))
    .filter((id) => isValidEventSourceId(id));

  const updates: Promise<void>[] = [];
  let tasks = 0;
  let events = 0;

  taskRows.forEach((row, index) => {
    if (rowBlank(row)) return;
    const currentId = cell(row, 0);
    const clientCase = cell(row, 5);
    const rowNumber = index + 2;
    const needsNewId =
      !isValidTaskSourceId(currentId) ||
      (clientCase && isValidTaskSourceId(currentId) && !idMatchesClientCase(currentId, clientCase));

    if (!needsNewId) return;

    const newId = generateSourceId(knownTaskIds, clientCase, "TASK");
    knownTaskIds.push(newId);
    updates.push(
      updateSheetValues(accessToken, toA1Range(SHEETS.tasks, `A${rowNumber}`), [[newId]])
    );
    tasks++;
  });

  eventRows.forEach((row, index) => {
    if (rowBlank(row)) return;
    const currentId = cell(row, 0);
    const clientCase = cell(row, 8);
    const rowNumber = index + 2;
    const needsNewId =
      !isValidEventSourceId(currentId) ||
      (clientCase && isValidEventSourceId(currentId) && !idMatchesClientCase(currentId, clientCase));

    if (!needsNewId) return;

    const newId = generateSourceId(knownEventIds, clientCase, "EVT");
    knownEventIds.push(newId);
    updates.push(
      updateSheetValues(accessToken, toA1Range(SHEETS.events, `A${rowNumber}`), [[newId]])
    );
    events++;
  });

  if (updates.length) {
    await Promise.all(updates);
  }

  return { tasks, events };
}
