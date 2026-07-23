import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { sendPrepChecklistNudges } from "@/lib/office-tasks/prep-nudge-automation";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — hearing prep checklist nudges. */
export async function GET(request: Request) {
  return runCronRoute(request, "prep-nudges", async () => {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      throw new Error("Cron Google token not configured.");
    }
    const result = await sendPrepChecklistNudges(accessToken);
    return { ...result, message: result.message || "Prep nudges sent." };
  });
}
