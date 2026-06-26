import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { cancelStaffCashAdvance, recordStaffCashAdvance, updateStaffCashAdvance } from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      action?: "record" | "cancel" | "update";
      staffId?: string;
      amount?: number;
      termMonths?: 2 | 3;
      date?: string;
      note?: string;
      advanceId?: string;
    };

    const accessToken = await requireSessionAccessToken();
    const staffId = String(body.staffId || "").trim();
    const action = body.action === "cancel" ? "cancel" : body.action === "update" ? "update" : "record";

    if (action === "cancel") {
      const cashAdvances = await cancelStaffCashAdvance(accessToken, staffId, String(body.advanceId || "").trim());
      invalidateCache(accessToken, "staff-salary");
      return NextResponse.json({
        cashAdvances,
        message: "Cash advance cancelled."
      });
    }

    if (action === "update") {
      const cashAdvances = await updateStaffCashAdvance(accessToken, {
        staffId,
        advanceId: String(body.advanceId || "").trim(),
        amount: body.amount,
        termMonths: Number(body.termMonths) === 3 ? 3 : 2,
        date: body.date,
        note: body.note
      });
      invalidateCache(accessToken, "staff-salary");
      return NextResponse.json({
        cashAdvances,
        message: "Cash advance updated."
      });
    }

    const cashAdvances = await recordStaffCashAdvance(accessToken, {
      staffId,
      amount: Number(body.amount),
      termMonths: Number(body.termMonths) === 3 ? 3 : 2,
      date: body.date,
      note: body.note
    });

    invalidateCache(accessToken, "staff-salary");

    return NextResponse.json({
      cashAdvances,
      message: "Cash advance recorded. Repayments will deduct automatically on each payday."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to record cash advance.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Enter") ||
            message.includes("Unknown") ||
            message.includes("not found") ||
            message.includes("Cannot cancel")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
