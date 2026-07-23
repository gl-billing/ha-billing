import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";
import { seedUpcomingBirDeadlines } from "@/lib/tax-deadlines-autopilot";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — seed upcoming BIR filing deadlines (1st of each month). */
export async function GET(request: Request) {
  return runCronRoute(request, "bir-deadlines", async () => {
    let directToken: string | null = null;
    try {
      directToken = await getCronGoogleAccessToken();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Cron Google token refresh failed.");
    }

    if (directToken) {
      const result = await seedUpcomingBirDeadlines(directToken, { horizonDays: 120 });
      return {
        ...result,
        via: "direct",
        message:
          result.created > 0
            ? `Created ${result.created} BIR deadline(s).`
            : "No new BIR deadlines to seed."
      };
    }

    if (!isTasksAppsScriptConfigured()) {
      throw new Error(
        "Set CRON_GOOGLE_REFRESH_TOKEN (or CRON_GOOGLE_ACCESS_TOKEN), configure TASKS_APPS_SCRIPT, or use Tools → BIR tracker → Seed upcoming deadlines."
      );
    }

    const result = await callTasksAppsScript("seedBirDeadlines", { horizonDays: 120 });
    return {
      message: result.message || "BIR deadline autopilot completed.",
      via: "apps-script",
      created: (result as { created?: number }).created
    };
  });
}
