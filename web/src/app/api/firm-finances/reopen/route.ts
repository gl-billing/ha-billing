import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { reopenAllocationMonth } from "@/lib/sheets/firm-allocation";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { year?: number; month?: number };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const month = Number(body.month) || now.getMonth() + 1;

    const accessToken = await requireSessionAccessToken();
    const report = await reopenAllocationMonth(accessToken, year, month);
    invalidateCache(accessToken, `firm-allocation:${year}-${month}`);

    return NextResponse.json({
      report,
      message: `${report.monthLabel} reopened for relabeling. Bucket balances were not reversed.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to reopen month.";
    const status = message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
