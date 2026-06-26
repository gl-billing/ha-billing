import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { saveStaffBaseSalary } from "@/lib/sheets/staff-salary";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { staffId?: string; baseSalary?: number };
    const staffId = String(body.staffId || "").trim();
    const accessToken = await requireSessionAccessToken();
    const baseSalary = await saveStaffBaseSalary(accessToken, staffId, Number(body.baseSalary));

    invalidateCache(accessToken, "staff-salary");

    return NextResponse.json({
      staffId,
      baseSalary,
      message: "Base salary saved."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save base salary.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Enter") || message.includes("Unknown")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
