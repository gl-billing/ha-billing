import { CRON_GOOGLE_TOKEN_HINT, getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runDailyBirthdayGreetings } from "@/lib/sheets/birthday-greetings";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — send client birthday greetings daily. */
export async function GET(request: Request) {
  return runCronRoute(request, "birthday-greetings", async () => {
    const token = await getCronGoogleAccessToken();
    if (!token) {
      throw new Error(CRON_GOOGLE_TOKEN_HINT);
    }

    const fromEmail =
      process.env.FIRM_SENDER_EMAIL?.trim() || process.env.CRON_FROM_EMAIL?.trim() || undefined;
    const result = await runDailyBirthdayGreetings(token, {
      fromEmail,
      actorEmail: "birthday-cron"
    });

    return {
      ...result,
      message:
        result.sent.length > 0
          ? `Sent ${result.sent.length} birthday greeting(s).`
          : result.candidates > 0
            ? "Birthday candidates found but none were sent."
            : "No birthday greetings due today."
    };
  });
}
