import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getStaffSalaryReport } from "@/lib/sheets/staff-salary";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;
    const staffId = String(searchParams.get("staffId") || "jas").trim();

    const report = await withCache(accessToken, `staff-salary:${staffId}:${year}-${month}`, 5 * 60_000, () =>
      getStaffSalaryReport(accessToken, staffId, year, month)
    );

    return NextResponse.json(report);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load staff salary.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Unknown staff")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
