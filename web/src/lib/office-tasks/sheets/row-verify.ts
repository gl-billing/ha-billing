import { SHEETS } from "@/lib/tasks-config";
import { getSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { columnIndexToLetter } from "@/lib/office-tasks/sheets/column-letter";
import { EVENT_HEADERS, TASK_HEADERS } from "@/lib/tasks-config";
import { isValidEventSourceId, isValidTaskSourceId } from "@/lib/office-tasks/sheets/repair-source-ids";

export type SheetRowMatch = {
  rowNumber: number;
  id: string;
};

async function findIdInSheet(
  accessToken: string,
  sheetName: string,
  endColumn: string,
  id: string,
  isValidId: (value: string) => boolean
): Promise<SheetRowMatch | null> {
  const target = id.trim();
  if (!target) return null;

  const rows = await getSheetValues(accessToken, toA1Range(sheetName, `A2:${endColumn}`));
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] || [];
    const inColumnA = String(row[0] || "").trim();
    if (inColumnA === target) {
      return { rowNumber: index + 2, id: inColumnA };
    }
    for (const cell of row) {
      const text = String(cell || "").trim();
      if (text === target && isValidId(text)) {
        return { rowNumber: index + 2, id: text };
      }
    }
  }
  return null;
}

export async function findEventRowById(
  accessToken: string,
  eventId: string
): Promise<SheetRowMatch | null> {
  return findIdInSheet(
    accessToken,
    SHEETS.events,
    columnIndexToLetter(EVENT_HEADERS.length),
    eventId,
    isValidEventSourceId
  );
}

export async function findTaskRowById(
  accessToken: string,
  taskId: string
): Promise<SheetRowMatch | null> {
  return findIdInSheet(
    accessToken,
    SHEETS.tasks,
    columnIndexToLetter(TASK_HEADERS.length),
    taskId,
    isValidTaskSourceId
  );
}
