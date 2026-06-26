import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { closeAllocationMonth } from "@/lib/sheets/firm-allocation";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { year?: number; month?: number; force?: boolean };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const month = Number(body.month) || now.getMonth() + 1;

    const accessToken = await requireSessionAccessToken();
    const report = await closeAllocationMonth(accessToken, year, month, { force: body.force === true });
    invalidateCache(accessToken, `firm-allocation:${year}-${month}`);

    return NextResponse.json({
      report,
      message: `${report.monthLabel} marked closed and bucket balances updated.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to close month.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("already marked closed") || message.includes("Resolve Needs review")
          ? 409
          : message.includes("Fix allocation policy")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
