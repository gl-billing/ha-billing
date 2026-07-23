import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { sendPreHearingBriefs } from "@/lib/office-tasks/hearing-follow-up-automations";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — pre-hearing brief emails. */
export async function GET(request: Request) {
  return runCronRoute(request, "pre-hearing-briefs", async () => {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      throw new Error("Cron Google token not configured.");
    }
    const result = await sendPreHearingBriefs(accessToken, { daysBefore: 3 });
    return {
      sent: result.sent,
      skipped: result.skipped,
      message:
        result.sent.length > 0
          ? `Sent ${result.sent.length} pre-hearing brief(s).`
          : "No pre-hearing briefs due today."
    };
  });
}
