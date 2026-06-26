import { SHEETS } from "@/lib/tasks-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getSheetsClient, getSpreadsheetId } from "@/lib/office-tasks/sheets/client";

async function getOfficeSheetId(accessToken: string, title: string): Promise<number | null> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties"
  });
  const sheet = (meta.data.sheets || []).find((entry) => entry.properties?.title === title);
  const id = sheet?.properties?.sheetId;
  return id === undefined || id === null ? null : id;
}

/** Permanently remove task/event rows from Master Tasks and Hearings & Events. */
export async function deleteOfficeItemsPermanently(
  accessToken: string,
  items: Pick<OfficeItem, "source" | "rowNumber">[]
): Promise<number> {
  if (!items.length) return 0;

  const [tasksSheetId, eventsSheetId] = await Promise.all([
    getOfficeSheetId(accessToken, SHEETS.tasks),
    getOfficeSheetId(accessToken, SHEETS.events)
  ]);

  const rowsBySheetId = new Map<number, number[]>();

  for (const item of items) {
    const sheetId = item.source === "Task" ? tasksSheetId : eventsSheetId;
    if (sheetId === null) continue;
    const rows = rowsBySheetId.get(sheetId) || [];
    rows.push(item.rowNumber);
    rowsBySheetId.set(sheetId, rows);
  }

  const requests: Array<Record<string, unknown>> = [];

  for (const [sheetId, rowNumbers] of rowsBySheetId) {
    const uniqueDescending = [...new Set(rowNumbers)].sort((a, b) => b - a);
    for (const rowNumber of uniqueDescending) {
      if (rowNumber < 2) continue;
      requests.push({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          }
        }
      });
    }
  }

  if (!requests.length) return 0;

  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { requests }
  });

  return requests.length;
}
