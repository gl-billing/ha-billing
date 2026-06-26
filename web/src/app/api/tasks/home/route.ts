import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isAdminEmail } from "@/lib/office-tasks/admin";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import {
  computeTodayCounts,
  filterTodayLists,
  searchItems,
  type OfficeItem
} from "@/lib/office-tasks/sheets/items";
import {
  filterItemsBySmartIntent,
  parseSmartSearchQuery
} from "@/lib/smart-search-query";
import { getFormOptions } from "@/lib/office-tasks/sheets/tasks";
import {
  assertTasksWorkbookSheetsCached,
  getCachedAllItems,
  getCachedEmployeeDirectory,
  runThrottledAutoRepairs,
  withCachedTasksHome
} from "@/lib/office-tasks/tasks-cache";
import { warmWorkspaceSheetCaches } from "@/lib/sheets/workspace-bootstrap";
import {
  computeEmployeeStats,
  getMondayOfWeek,
  getWeekDates,
  todayYmd
} from "@/lib/office-tasks/schedule";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";
import { isUsingBillingSpreadsheetFallback } from "@/lib/office-tasks/sheets/client";

function serializeItems(items: OfficeItem[]) {
  return items.map((item) => ({ ...item }));
}

export async function GET(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const fresh = searchParams.get("fresh") === "1";

    await warmWorkspaceSheetCaches(token, fresh);

    const payload = await withCachedTasksHome(token, q, async () => {
      await assertTasksWorkbookSheetsCached(token);
      await runThrottledAutoRepairs(token);

      const [items, employeeDirectory] = await Promise.all([
        getCachedAllItems(token, fresh),
        getCachedEmployeeDirectory(token)
      ]);
      const counts = computeTodayCounts(items);
      const lists = filterTodayLists(items);
      const employees = employeeDirectory.map((e) => e.name);
      const options = getFormOptions();
      const today = todayYmd();
      const weekStart = getMondayOfWeek(today);
      const weekDates = getWeekDates(weekStart);
      const employeeStats = computeEmployeeStats(items, employees, today, weekDates);
      const intent = q ? parseSmartSearchQuery(q, employees) : null;
      const searchResults = q
        ? intent?.parsed
          ? filterItemsBySmartIntent(items, intent, employees).slice(0, 100)
          : searchItems(items, q, 100)
        : [];
      const session = await getServerSession(authOptions);
      const isAdmin = isAdminEmail(session?.user?.email);

      return {
        isAdmin,
        counts,
        lists,
        employees,
        employeeDirectory,
        options,
        searchResults,
        items: serializeItems(items),
        today,
        weekStart,
        employeeStats,
        spreadsheetId:
          process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim() ||
          process.env.GOOGLE_SPREADSHEET_ID?.trim() ||
          "",
        tasksAppsScriptConfigured: isTasksAppsScriptConfigured(),
        tasksSpreadsheetFallback: isUsingBillingSpreadsheetFallback()
      };
    }, fresh);

    return NextResponse.json(payload);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load dashboard.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
