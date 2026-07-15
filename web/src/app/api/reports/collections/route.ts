import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getMonthlyCollectionsReport } from "@/lib/sheets/reports";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    const report = await withCache(accessToken, `collections:${year}-${month}`, 5 * 60_000, () =>
      getMonthlyCollectionsReport(accessToken, year, month)
    );
    return NextResponse.json(report);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load collections report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
