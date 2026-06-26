import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import {
  batchGetSheetValues,
  getSpreadsheetId,
  listSheetTitles,
  toA1Range
} from "@/lib/office-tasks/sheets/client";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { SHEETS } from "@/lib/tasks-config";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { findEventRowById } from "@/lib/office-tasks/sheets/row-verify";

export async function GET(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const lookupId = new URL(request.url).searchParams.get("id")?.trim() || "";
    const spreadsheetId = getSpreadsheetId();
    const titles = await listSheetTitles(token);
    const eventRange = toA1Range(SHEETS.events, "A2:Q");
    const [rawRows] = await batchGetSheetValues(token, [eventRange]);
    const items = await getCachedAllItems(token);
    const today = todayYmd();

    const events = items.filter((item) => item.source === "Event");
    const tasks = items.filter((item) => item.source === "Task");

    const summarizeRaw = (row: string[]) => ({
      id: row[0] ?? "",
      dateLogged: row[1] ?? "",
      eventDate: row[2] ?? "",
      category: row[5] ?? "",
      clientCase: row[8] ?? "",
      details: row[10] ?? "",
      status: row[13] ?? "",
      filingDeadline: row[16] ?? ""
    });

    const rawEventRows = rawRows || [];
    const matchingRaw = rawEventRows.filter((row) => {
      const hay = [row[0], row[5], row[8], row[10]].join(" ").toLowerCase();
      return hay.includes("gdci") || hay.includes("hakola") || hay.includes("gdc-evt");
    });

    const idLookup = lookupId ? await findEventRowById(token, lookupId) : null;

    return NextResponse.json({
      today,
      spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      lookupId: lookupId || undefined,
      lookupRow: idLookup?.rowNumber,
      lookupFound: Boolean(idLookup),
      tabs: titles,
      hasEventsTab: titles.includes(SHEETS.events),
      rawEventRowCount: rawEventRows.length,
      parsedTaskCount: tasks.length,
      parsedEventCount: events.length,
      eventsToday: events.filter((item) => item.date === today && !item.done),
      eventsMissingDate: events.filter((item) => !item.date).map((item) => ({
        id: item.id,
        clientCase: item.clientCase,
        category: item.category,
        rowNumber: item.rowNumber
      })),
      gdciEvents: events.filter((item) => /gdci/i.test(item.clientCase)),
      hakolaEvents: events.filter((item) => /hakola/i.test(item.clientCase)),
      lastRawRows: rawEventRows.slice(-8).map(summarizeRaw),
      matchingRawRows: matchingRaw.slice(-8).map(summarizeRaw)
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Diagnostics failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
