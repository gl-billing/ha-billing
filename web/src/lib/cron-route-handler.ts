import { NextResponse } from "next/server";
import type { CronJobId } from "@/lib/cron-jobs";
import { alertOnRepeatedCronFailure } from "@/lib/cron-failure-alert";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { recordCronRun } from "@/lib/cron-run-log";
import { alertOnBackupFailure } from "@/lib/cron-backup-alert";

function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";
  return Boolean(expected && auth === `Bearer ${expected}`);
}

export async function runCronRoute(
  request: Request,
  jobId: CronJobId,
  handler: () => Promise<{ message: string } & Record<string, unknown>>
): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getCronGoogleAccessToken();
  } catch {
    accessToken = null;
  }

  try {
    const result = await handler();
    const message = result.message || "Cron completed.";
    await recordCronRun(accessToken, jobId, "ok", message);
    return NextResponse.json({ ok: true, ...result, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${jobId} cron failed.`;
    await recordCronRun(accessToken, jobId, "error", message);
    await alertOnRepeatedCronFailure(accessToken, jobId, message);
    if (jobId === "sheets-backup") {
      await alertOnBackupFailure(accessToken, message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
