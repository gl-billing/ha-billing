import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import {
  buildStaffPayRunPayslipPreview,
  sendStaffPayRunPayslipEmail
} from "@/lib/staff-salary-payslip-email";
import { getStaffSalaryReport } from "@/lib/sheets/staff-salary";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

type PayRunParams = {
  staffId: string;
  year: number;
  month: number;
  period: "mid" | "end";
};

function parseQueryParams(request: Request): PayRunParams {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  return {
    staffId: String(searchParams.get("staffId") || "jas").trim(),
    year: Number(searchParams.get("year")) || now.getFullYear(),
    month: Number(searchParams.get("month")) || now.getMonth() + 1,
    period: searchParams.get("period") === "end" ? "end" : "mid"
  };
}

function parseBodyParams(body: {
  staffId?: string;
  year?: number;
  month?: number;
  period?: "mid" | "end";
}): PayRunParams {
  const now = new Date();
  return {
    staffId: String(body.staffId || "jas").trim(),
    year: Number(body.year) || now.getFullYear(),
    month: Number(body.month) || now.getMonth() + 1,
    period: body.period === "end" ? "end" : "mid"
  };
}

async function loadPaidPayRun(params: PayRunParams) {
  const session = await getServerSession(authOptions);
  requireAdminEmail(session?.user?.email);

  const accessToken = await requireSessionAccessToken();
  const [report, directory] = await Promise.all([
    getStaffSalaryReport(accessToken, params.staffId, params.year, params.month),
    getEmployeeDirectory(accessToken)
  ]);

  const run = report.payRuns.find((entry) => entry.period === params.period);
  if (!run?.paid) {
    throw new Error("Record payment for this pay run before previewing or emailing the payslip.");
  }

  return { session, accessToken, report, directory, period: params.period };
}

function errorResponse(error: unknown, fallback: string) {
  if (isQuotaError(error)) {
    return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.startsWith("Unauthorized") || message.includes("firm admins")
      ? 403
      : message.includes("Record payment")
        ? 409
        : message.includes("Unknown") || message.includes("not found")
          ? 404
          : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { report, directory, period } = await loadPaidPayRun(parseQueryParams(request));
    return NextResponse.json(buildStaffPayRunPayslipPreview(report, period, directory));
  } catch (error) {
    return errorResponse(error, "Failed to load payslip preview.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      staffId?: string;
      year?: number;
      month?: number;
      period?: "mid" | "end";
    };
    const { session, accessToken, report, directory, period } = await loadPaidPayRun(parseBodyParams(body));
    const senderEmail = String(session?.user?.email || "").trim();
    const result = await sendStaffPayRunPayslipEmail({
      accessToken,
      senderEmail,
      report,
      period,
      directory
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      message: result.message,
      recipient: result.recipient
    });
  } catch (error) {
    return errorResponse(error, "Failed to email payslip.");
  }
}
