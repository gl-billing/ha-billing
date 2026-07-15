import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getHomeDashboard } from "@/lib/sheets/home";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const home = await getHomeDashboard(accessToken);
    return NextResponse.json(home);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load firm overview.";
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
