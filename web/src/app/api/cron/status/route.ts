import { NextResponse } from "next/server";
import { isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";

/** Staff-visible hint — whether morning digest cron can run (no secrets exposed). */
export async function GET() {
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const tasksScriptConfigured = isTasksAppsScriptConfigured();

  let message: string;
  if (cronConfigured && tasksScriptConfigured) {
    message = "Morning staff digest cron is configured on the server.";
  } else if (!cronConfigured && !tasksScriptConfigured) {
    message = "Morning digest not configured — set CRON_SECRET and Tasks Apps Script URL on Vercel.";
  } else if (!cronConfigured) {
    message = "Morning digest needs CRON_SECRET on Vercel (see DEPLOY.md).";
  } else {
    message = "Morning digest needs Tasks Apps Script URL configured on Vercel.";
  }

  return NextResponse.json({
    configured: cronConfigured,
    tasksScriptConfigured,
    message
  });
}
