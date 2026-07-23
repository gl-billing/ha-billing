import { callAppsScriptWebApp, isAppsScriptConfigured, appsScriptConfigError } from "@/lib/apps-script";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — hourly dashboard refresh (see vercel.json crons). */
export async function GET(request: Request) {
  return runCronRoute(request, "refresh-dashboard", async () => {
    if (!isAppsScriptConfigured()) {
      throw new Error(appsScriptConfigError());
    }
    const result = await callAppsScriptWebApp("refreshDashboard", {});
    return { message: result.message || "Dashboard refreshed." };
  });
}
