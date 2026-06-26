import { NextResponse } from "next/server";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { callTasksAppsScript, isTasksAppsScriptConfigured } from "@/lib/office-tasks/apps-script";
import { seedUpcomingBirDeadlines } from "@/lib/tax-deadlines-autopilot";

/** Vercel Cron — seed upcoming BIR filing deadlines (1st of each month). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let directToken: string | null = null;
  try {
    directToken = await getCronGoogleAccessToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron Google token refresh failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (directToken) {
    try {
      const result = await seedUpcomingBirDeadlines(directToken, { horizonDays: 120 });
      return NextResponse.json({
        ok: true,
        via: "direct",
        message:
          result.created > 0
            ? `Created ${result.created} BIR deadline(s).`
            : "No new BIR deadlines to seed.",
        ...result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "BIR autopilot failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!isTasksAppsScriptConfigured()) {
    return NextResponse.json(
      {
        error:
          "Set CRON_GOOGLE_REFRESH_TOKEN (or CRON_GOOGLE_ACCESS_TOKEN), configure TASKS_APPS_SCRIPT, or use Tools → BIR tracker → Seed upcoming deadlines."
      },
      { status: 503 }
    );
  }

  try {
    const result = await callTasksAppsScript("seedBirDeadlines", { horizonDays: 120 });
    return NextResponse.json({
      ok: true,
      via: "apps-script",
      message: result.message || "BIR deadline autopilot completed.",
      created: (result as { created?: number }).created
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BIR autopilot cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
