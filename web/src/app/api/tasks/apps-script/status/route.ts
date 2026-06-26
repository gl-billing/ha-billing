import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";

export async function GET() {
  try {
    await requireSessionAccessToken();

    const hasUrl = Boolean(process.env.TASKS_APPS_SCRIPT_WEB_APP_URL?.trim());
    const hasSecret = Boolean(process.env.TASKS_APPS_SCRIPT_WEB_APP_SECRET?.trim());
    const configured = isTasksAppsScriptConfigured();

    if (!configured) {
      return NextResponse.json({
        ok: false,
        configured: false,
        hasUrl,
        hasSecret,
        billingBridgeConfigured: Boolean(
          process.env.APPS_SCRIPT_WEB_APP_URL?.trim() &&
            process.env.APPS_SCRIPT_WEB_APP_SECRET?.trim()
        ),
        hint:
          "Set TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET (Office Tasks spreadsheet web app). Billing APPS_SCRIPT_* is a different deployment."
      });
    }

    const ping = await callTasksAppsScript("ping");
    return NextResponse.json({
      ok: true,
      configured: true,
      hasUrl,
      hasSecret,
      service: (ping as { service?: string }).service || ping.message,
      scriptUser: (ping as { user?: string }).user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tasks Apps Script check failed.";
    return NextResponse.json(
      {
        ok: false,
        configured: isTasksAppsScriptConfigured(),
        error: message
      },
      { status: 500 }
    );
  }
}
