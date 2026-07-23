import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { sendPostHearingOutcomeWarnings } from "@/lib/office-tasks/post-hearing-warning-automation";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — post-hearing outcome warnings. */
export async function GET(request: Request) {
  return runCronRoute(request, "post-hearing-warnings", async () => {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      throw new Error("Cron Google token not configured.");
    }
    const result = await sendPostHearingOutcomeWarnings(accessToken);
    return { ...result, message: result.message || "Post-hearing warnings sent." };
  });
}
