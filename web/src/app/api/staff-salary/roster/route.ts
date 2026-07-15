import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireTeamRosterAdmin } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { activePayrollRoster } from "@/lib/staff-payroll-roster";
import { getStaffPayrollRoster, saveStaffPayrollRoster } from "@/lib/sheets/staff-payroll-roster";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireTeamRosterAdmin(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const roster = await getStaffPayrollRoster(accessToken);
    return NextResponse.json({ roster: activePayrollRoster(roster) });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load payroll roster.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireTeamRosterAdmin(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as { roster?: unknown };
    const roster = Array.isArray(body.roster) ? body.roster : [];
    const saved = await saveStaffPayrollRoster(accessToken, roster as Parameters<typeof saveStaffPayrollRoster>[1]);
    return NextResponse.json({ roster: activePayrollRoster(saved) });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save payroll roster.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
