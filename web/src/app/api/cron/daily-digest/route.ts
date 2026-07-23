import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runCronRoute } from "@/lib/cron-route-handler";
import { sendFirmDailyDigest } from "@/lib/office-tasks/daily-digest-send";

async function runDailyDigestCron() {
  const accessToken = await getCronGoogleAccessToken();
  if (!accessToken) {
    throw new Error("Cron Google token not configured.");
  }

  const result = await sendFirmDailyDigest(accessToken);
  return { ...result, message: result.message || "Daily digest sent." };
}

/** Vercel Cron — firm-wide daily digest. */
export async function GET(request: Request) {
  return runCronRoute(request, "daily-digest", runDailyDigestCron);
}

export async function POST(request: Request) {
  return runCronRoute(request, "daily-digest", runDailyDigestCron);
}
