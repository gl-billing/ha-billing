import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteStaffSalaryAdjustment,
  recordStaffSalaryAdjustment,
  updateStaffSalaryAdjustment
} from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import type { StaffSalaryOvertimeMeta } from "@/lib/staff-salary";

function errorStatus(message: string): number {
  if (message.startsWith("Unauthorized") || message.includes("firm admins")) return 403;
  if (
    message.includes("Enter") ||
    message.includes("Unknown") ||
    message.includes("not found") ||
    message.includes("Cannot") ||
    message.includes("Invalid") ||
    message.includes("Reopen") ||
    message.includes("managed on")
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      staffId?: string;
      label?: string;
      amount?: number;
      note?: string;
      date?: string;
      kind?: "manual" | "overtime" | "thirteenthMonth";
      overtime?: StaffSalaryOvertimeMeta;
    };

    const accessToken = await requireSessionAccessToken();
    const adjustments = await recordStaffSalaryAdjustment(accessToken, {
      staffId: String(body.staffId || "jas").trim(),
      label: String(body.label || ""),
      amount: Number(body.amount),
      note: body.note,
      date: body.date,
      kind: body.kind,
      overtime: body.overtime
    });

    invalidateCache(accessToken, "staff-salary");

    return NextResponse.json({
      adjustments,
      message: "Salary adjustment recorded."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to record adjustment.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      id?: string;
      staffId?: string;
      label?: string;
      amount?: number;
      note?: string;
      date?: string;
      overtime?: StaffSalaryOvertimeMeta;
    };

    const accessToken = await requireSessionAccessToken();
    const adjustments = await updateStaffSalaryAdjustment(accessToken, {
      id: String(body.id || "").trim(),
      staffId: String(body.staffId || "jas").trim(),
      label: body.label,
      amount: body.amount,
      note: body.note,
      date: body.date,
      overtime: body.overtime
    });

    invalidateCache(accessToken, "staff-salary");

    return NextResponse.json({
      adjustments,
      message: "Adjustment updated."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to update adjustment.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const url = new URL(request.url);
    const staffId = String(url.searchParams.get("staffId") || "jas").trim();
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Adjustment id is required." }, { status: 400 });
    }

    const accessToken = await requireSessionAccessToken();
    const adjustments = await deleteStaffSalaryAdjustment(accessToken, staffId, id);
    invalidateCache(accessToken, "staff-salary");

    return NextResponse.json({
      adjustments,
      message: "Adjustment deleted."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete adjustment.";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
