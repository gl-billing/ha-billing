import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runCronRoute } from "@/lib/cron-route-handler";
import { sendRetainerEveDigest } from "@/lib/retainer-eve-digest";

/** Day-before retainer dues digest. */
async function run() {
  const accessToken = await getCronGoogleAccessToken();
  if (!accessToken) {
    throw new Error("Set CRON_GOOGLE_REFRESH_TOKEN for retainer eve digest.");
  }

  const result = await sendRetainerEveDigest(accessToken);
  return { ...result, message: result.message };
}

export async function GET(request: Request) {
  return runCronRoute(request, "retainer-digest", run);
}

export async function POST(request: Request) {
  return runCronRoute(request, "retainer-digest", run);
}
