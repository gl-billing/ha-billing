import { NextResponse } from "next/server";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";

/** Vercel Cron — daily staff morning digest (tasks due today + overdue per employee). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isTasksAppsScriptConfigured()) {
    return NextResponse.json(
      {
        error:
          "Configure TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET, or send reminders manually from Tasks → Tools."
      },
      { status: 503 }
    );
  }

  try {
    const digest = await callTasksAppsScript("sendAllStaffReminders", { scope: "both" });
    const stale = await callTasksAppsScript("sendStaleFollowUpNudges", {}).catch(() => ({
      ok: true,
      message: "Stale nudges included in morning digest."
    }));

    return NextResponse.json({
      ok: true,
      message: digest.message || "Morning digest dispatched.",
      sent: (digest as { sent?: number }).sent,
      stale: stale.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Morning digest cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
