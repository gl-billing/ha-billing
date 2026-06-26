import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  postStaff13thMonthAdjustment,
  removeStaff13thMonthPayrollAdjustment,
  syncStaff13thMonthPayrollAdjustment
} from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

function invalidate13thMonthCaches(accessToken: string, staffId: string, year: number) {
  invalidateCache(accessToken, `staff-salary-13th:${staffId}:${year}`);
  invalidateCache(accessToken, "staff-salary");
  invalidateCache(accessToken, `staff-salary:${staffId}:${year}-12`);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { staffId?: string; year?: number };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const staffId = String(body.staffId || "").trim();

    const accessToken = await requireSessionAccessToken();
    const result = await postStaff13thMonthAdjustment(accessToken, staffId, year);
    invalidate13thMonthCaches(accessToken, staffId, year);

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to post 13th month adjustment.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("already posted") || message.includes("greater than zero") || message.includes("Unknown")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { staffId?: string; year?: number };
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const staffId = String(body.staffId || "").trim();

    const accessToken = await requireSessionAccessToken();
    const result = await syncStaff13thMonthPayrollAdjustment(accessToken, staffId, year);
    invalidate13thMonthCaches(accessToken, staffId, year);

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to update 13th month payroll line.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("not posted") || message.includes("not found") || message.includes("Reopen")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year")) || now.getFullYear();
    const staffId = String(url.searchParams.get("staffId") || "").trim();

    const accessToken = await requireSessionAccessToken();
    const result = await removeStaff13thMonthPayrollAdjustment(accessToken, staffId, year);
    invalidate13thMonthCaches(accessToken, staffId, year);

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to remove 13th month payroll line.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("not posted") || message.includes("Reopen")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
