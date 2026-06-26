import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { reopenStaffSalaryMonth } from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      staffId?: string;
      year?: number;
      month?: number;
      period?: "mid" | "end";
    };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const month = Number(body.month) || now.getMonth() + 1;
    const staffId = String(body.staffId || "").trim();
    const period = body.period === "end" ? "end" : "mid";

    const accessToken = await requireSessionAccessToken();
    const report = await reopenStaffSalaryMonth(accessToken, staffId, year, month, period);
    invalidateCache(accessToken, `staff-salary:${staffId}:${year}-${month}`);

    return NextResponse.json({
      report,
      message: `${report.monthLabel} ${period === "mid" ? "mid-month" : "end-of-month"} pay reopened for ${report.staffName}.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to reopen salary month.";
    const status = message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
