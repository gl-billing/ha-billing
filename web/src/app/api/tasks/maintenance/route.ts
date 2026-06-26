import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/office-tasks/admin";
import { callTasksAppsScript } from "@/lib/office-tasks/apps-script";
import {
  consolidateOfficeSheetRows,
  formatConsolidateSummary
} from "@/lib/office-tasks/sheets/consolidate-sheet-rows";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const APPS_SCRIPT_ACTIONS = [
  "refreshAllOverviews",
  "sendRemindersNow",
  "syncUpcomingCalendar",
  "syncAllOpenCalendar"
] as const;

const LOCAL_ACTIONS = ["consolidateSheetRows"] as const;

const ALLOWED_ACTIONS = [...APPS_SCRIPT_ACTIONS, ...LOCAL_ACTIONS] as const;

type MaintenanceAction = (typeof ALLOWED_ACTIONS)[number];

const ACTION_MAP: Record<(typeof APPS_SCRIPT_ACTIONS)[number], string> = {
  refreshAllOverviews: "refreshAllOverviews",
  sendRemindersNow: "sendRemindersNow",
  syncUpcomingCalendar: "syncUpcomingCalendar",
  syncAllOpenCalendar: "syncAllOpenCalendar"
};

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    const body = (await request.json()) as { action?: string };
    const action = body.action as MaintenanceAction;

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown maintenance action." }, { status: 400 });
    }

    if (action === "sendRemindersNow" && !isAdminEmail(email)) {
      return NextResponse.json({ error: "Only admins can send reminder emails from the web app." }, { status: 403 });
    }

    if (action === "consolidateSheetRows") {
      const result = await consolidateOfficeSheetRows(token);
      invalidateTasksDataCache(token);
      return NextResponse.json({ ok: true, message: formatConsolidateSummary(result), result });
    }

    const result = await callTasksAppsScript(ACTION_MAP[action as keyof typeof ACTION_MAP]);
    return NextResponse.json({ ok: true, message: result.message || "Done." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Maintenance action failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
