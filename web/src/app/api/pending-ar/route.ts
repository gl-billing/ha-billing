import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getPendingArEntries } from "@/lib/sheets/pending-ar";
import { withCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const entries = await withCache(accessToken, "pending-ar", 45_000, () =>
      getPendingArEntries(accessToken)
    );
    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load pending AR.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
