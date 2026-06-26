import { SHEETS } from "@/lib/tasks-config";
import { clientCodeFromCase, clientNameTokensInLabel, parseExplicitLabelCode } from "@/lib/office-tasks/client-matter";
import {
  appendSheetValues,
  getSheetValues,
  getSheetsClient,
  getSpreadsheetId,
  listSheetTitles,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";

export const ACTIVITY_LOG_SHEET = "Activity Log";

const HEADERS = [
  "Timestamp",
  "User",
  "Action",
  "Source",
  "Item ID",
  "Client / Case",
  "Summary",
  "Details"
] as const;

export type TaskActivityEntry = {
  logRow: number;
  timestamp: string;
  user: string;
  action: string;
  source: string;
  itemId: string;
  clientCase: string;
  summary: string;
  details: string;
};

async function ensureActivityLogSheet(accessToken: string): Promise<void> {
  const titles = await listSheetTitles(accessToken);
  if (!titles.includes(ACTIVITY_LOG_SHEET)) {
    const sheets = getSheetsClient(accessToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: ACTIVITY_LOG_SHEET } } }]
      }
    });
  }

  const headerRow = await getSheetValues(accessToken, toA1Range(ACTIVITY_LOG_SHEET, "A1:H1"));
  if (!headerRow[0]?.[0]) {
    await updateSheetValues(accessToken, toA1Range(ACTIVITY_LOG_SHEET, "A1:H1"), [[...HEADERS]]);
  }
}

export async function appendTaskActivity(
  accessToken: string,
  entry: {
    user: string;
    action: string;
    source: "Task" | "Event";
    itemId?: string;
    clientCase?: string;
    summary: string;
    details?: string;
  }
): Promise<void> {
  try {
    await ensureActivityLogSheet(accessToken);
    const timestamp = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila"
    });

    await appendSheetValues(accessToken, toA1Range(ACTIVITY_LOG_SHEET, "A:H"), [
      [
        timestamp,
        entry.user || "staff",
        entry.action,
        entry.source,
        entry.itemId || "",
        entry.clientCase || "",
        entry.summary,
        entry.details || ""
      ]
    ]);
  } catch {
    // Activity log is best-effort — never block task updates.
  }
}

export async function getTaskActivity(
  accessToken: string,
  options?: { limit?: number; clientCode?: string; clientName?: string }
): Promise<TaskActivityEntry[]> {
  const titles = await listSheetTitles(accessToken);
  if (!titles.includes(ACTIVITY_LOG_SHEET)) return [];

  const values = await getSheetValues(accessToken, toA1Range(ACTIVITY_LOG_SHEET, "A2:H"));
  let entries = values
    .filter((row) => row[0])
    .map((row, index) => ({
      logRow: index + 2,
      timestamp: String(row[0] || ""),
      user: String(row[1] || ""),
      action: String(row[2] || ""),
      source: String(row[3] || ""),
      itemId: String(row[4] || ""),
      clientCase: String(row[5] || ""),
      summary: String(row[6] || ""),
      details: String(row[7] || "")
    }));

  if (options?.clientCode) {
    const upper = options.clientCode.trim().toUpperCase();
    const clientName = options.clientName?.trim() || "";
    entries = entries.filter((entry) => {
      if (!entry.clientCase.trim()) return false;

      const explicit = parseExplicitLabelCode(entry.clientCase);
      if (explicit && explicit === upper) return true;
      if (clientName && clientNameTokensInLabel(clientName, entry.clientCase)) return true;

      const fromCase = clientCodeFromCase(entry.clientCase);
      if (fromCase === upper) return Boolean(clientName && clientNameTokensInLabel(clientName, entry.clientCase));

      return false;
    });
  }

  entries.sort((a, b) => b.logRow - a.logRow);
  if (options?.limit) entries = entries.slice(0, options.limit);
  return entries;
}
