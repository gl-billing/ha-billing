import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — daily staff morning digest (tasks due today + overdue per employee). */
export async function GET(request: Request) {
  return runCronRoute(request, "staff-digest", async () => {
    if (!isTasksAppsScriptConfigured()) {
      throw new Error(
        "Configure TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET, or send reminders manually from Tasks → Tools."
      );
    }

    const digest = await callTasksAppsScript("sendAllStaffReminders", { scope: "both" });
    const stale = await callTasksAppsScript("sendStaleFollowUpNudges", {}).catch(() => ({
      ok: true,
      message: "Stale nudges included in morning digest."
    }));

    return {
      message: digest.message || "Morning digest dispatched.",
      sent: (digest as { sent?: number }).sent,
      stale: stale.message
    };
  });
}
