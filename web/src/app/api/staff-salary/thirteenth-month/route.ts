import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  getStaff13thMonthReport,
  saveStaff13thMonthIncludedMonths
} from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const staffId = String(searchParams.get("staffId") || "").trim();

    const report = await withCache(accessToken, `staff-salary-13th:${staffId}:${year}`, 5 * 60_000, () =>
      getStaff13thMonthReport(accessToken, staffId, year)
    );

    return NextResponse.json(report);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load 13th month pay.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Unknown")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      staffId?: string;
      year?: number;
      months?: number[];
    };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const staffId = String(body.staffId || "").trim();
    const months = Array.isArray(body.months) ? body.months.map((month) => Number(month)) : [];

    const accessToken = await requireSessionAccessToken();
    const report = await saveStaff13thMonthIncludedMonths(accessToken, staffId, year, months);
    invalidateCache(accessToken, `staff-salary-13th:${staffId}:${year}`);

    return NextResponse.json({
      report,
      message: "13th month months updated."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to update 13th month months.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Select") || message.includes("Unknown")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
