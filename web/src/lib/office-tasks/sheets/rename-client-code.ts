import { SHEETS } from "@/lib/tasks-config";
import { batchGetSheetValues, batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";

const SOURCE_ID_RE = /^([A-Z]{2,3})-(TASK|EVT)-(\d{4})$/;

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function replaceSourceIdPrefix(id: string, oldCode: string, newCode: string): string | null {
  const upper = id.toUpperCase();
  const old = oldCode.toUpperCase();
  const next = newCode.toUpperCase();
  const match = upper.match(SOURCE_ID_RE);
  if (!match || match[1] !== old) return null;
  return `${next}-${match[2]}-${match[3]}`;
}

/** Update Task ID / Event ID prefixes when billing client code changes. */
export async function renameTaskSourceIdsForClientCode(
  accessToken: string,
  oldCode: string,
  newCode: string
): Promise<{ tasks: number; events: number }> {
  const oldUpper = oldCode.trim().toUpperCase();
  const newUpper = newCode.trim().toUpperCase();
  if (!oldUpper || !newUpper || oldUpper === newUpper) {
    return { tasks: 0, events: 0 };
  }

  const [taskRows, eventRows] = await batchGetSheetValues(accessToken, [
    toA1Range(SHEETS.tasks, "A2:A"),
    toA1Range(SHEETS.events, "A2:A")
  ]);

  const updates: Array<{ range: string; values: unknown[][] }> = [];
  let tasks = 0;
  let events = 0;

  taskRows.forEach((row, index) => {
    const currentId = cell(row, 0);
    const nextId = replaceSourceIdPrefix(currentId, oldUpper, newUpper);
    if (!nextId) return;
    updates.push({
      range: toA1Range(SHEETS.tasks, `A${index + 2}`),
      values: [[nextId]]
    });
    tasks++;
  });

  eventRows.forEach((row, index) => {
    const currentId = cell(row, 0);
    const nextId = replaceSourceIdPrefix(currentId, oldUpper, newUpper);
    if (!nextId) return;
    updates.push({
      range: toA1Range(SHEETS.events, `A${index + 2}`),
      values: [[nextId]]
    });
    events++;
  });

  if (updates.length) {
    await batchUpdateSheetValues(accessToken, updates);
  }

  return { tasks, events };
}
