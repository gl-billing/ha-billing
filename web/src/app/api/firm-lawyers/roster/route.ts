import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { activeFirmLawyersRoster } from "@/lib/firm-lawyers-roster";
import { getFirmLawyersRoster, saveFirmLawyersRoster } from "@/lib/sheets/firm-lawyers-roster";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const roster = await getFirmLawyersRoster(accessToken);
    return NextResponse.json({ roster: activeFirmLawyersRoster(roster) });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load lawyers roster.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as { roster?: unknown };
    const roster = Array.isArray(body.roster) ? body.roster : [];
    const saved = await saveFirmLawyersRoster(
      accessToken,
      roster as Parameters<typeof saveFirmLawyersRoster>[1]
    );
    return NextResponse.json({
      roster: activeFirmLawyersRoster(saved),
      message: "Lawyers saved and synced to Office Tasks Employees for task oversight."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save lawyers roster.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
