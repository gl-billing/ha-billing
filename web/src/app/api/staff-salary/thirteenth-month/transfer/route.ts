import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { markStaff13thMonthTransferred } from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { staffId?: string; year?: number; transferRef?: string };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const staffId = String(body.staffId || "jas").trim();

    const accessToken = await requireSessionAccessToken();
    const report = await markStaff13thMonthTransferred(
      accessToken,
      staffId,
      year,
      String(body.transferRef || "")
    );
    invalidateCache(accessToken, `staff-salary-13th:${staffId}:${year}`);

    return NextResponse.json({
      report,
      message: `${year} 13th month transfer recorded for ${report.staffName}.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to mark 13th month transfer.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("before marking") || message.includes("already marked") || message.includes("Unknown")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
