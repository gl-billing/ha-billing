import { NextResponse } from "next/server";
import { CRON_GOOGLE_TOKEN_HINT, getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runDailyBirthdayGreetings } from "@/lib/sheets/birthday-greetings";

/** Vercel Cron — send client birthday greetings daily (8:00 AM Asia/Manila). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let token: string | null;
  try {
    token = await getCronGoogleAccessToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron Google token refresh failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!token) {
    return NextResponse.json({ error: CRON_GOOGLE_TOKEN_HINT }, { status: 503 });
  }

  try {
    const fromEmail = process.env.FIRM_SENDER_EMAIL?.trim() || process.env.CRON_FROM_EMAIL?.trim() || undefined;
    const result = await runDailyBirthdayGreetings(token, {
      fromEmail,
      actorEmail: "birthday-cron"
    });

    return NextResponse.json({
      ok: true,
      message:
        result.sent.length > 0
          ? `Sent ${result.sent.length} birthday greeting(s).`
          : result.candidates > 0
            ? "Birthday candidates found but none were sent."
            : "No birthday greetings due today.",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Birthday greeting cron failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
