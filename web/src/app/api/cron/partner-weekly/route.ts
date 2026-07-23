import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — Monday partner weekly report via Apps Script email bridge. */
export async function GET(request: Request) {
  return runCronRoute(request, "partner-weekly", async () => {
    if (!isTasksAppsScriptConfigured()) {
      throw new Error(
        "Configure TASKS_APPS_SCRIPT for automated partner reports, or use Reports → Send weekly report."
      );
    }

    const result = await callTasksAppsScript("sendPartnerWeeklyReport", {});
    return { message: result.message || "Partner report dispatched." };
  });
}
