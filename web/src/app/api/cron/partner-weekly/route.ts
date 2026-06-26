import { NextResponse } from "next/server";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";

/** Vercel Cron — Monday 6:00 AM partner weekly report via Apps Script email bridge. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isTasksAppsScriptConfigured()) {
    return NextResponse.json(
      { error: "Configure TASKS_APPS_SCRIPT for automated partner reports, or use Reports → Send weekly report." },
      { status: 503 }
    );
  }

  try {
    const result = await callTasksAppsScript("sendPartnerWeeklyReport", {});
    return NextResponse.json({ ok: true, message: result.message || "Partner report dispatched." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Partner report cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
