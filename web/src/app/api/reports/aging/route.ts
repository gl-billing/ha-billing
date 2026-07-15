import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getArAgingReport } from "@/lib/sheets/reports";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const report = await withCache(accessToken, "report-aging", 60_000, () =>
      getArAgingReport(accessToken)
    );
    return NextResponse.json(report);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load aging report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
