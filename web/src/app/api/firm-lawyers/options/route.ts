import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccess } from "@/lib/app-access";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { buildFirmLawyerDropdownOptions } from "@/lib/assigned-lawyers";
import { authOptions } from "@/lib/auth";
import { getFirmLawyersRoster } from "@/lib/sheets/firm-lawyers-roster";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireBillingAccess(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const roster = await getFirmLawyersRoster(accessToken);
    return NextResponse.json({ lawyers: buildFirmLawyerDropdownOptions(roster) });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load lawyer list.";
    const status =
      message.includes("billing system") || message.startsWith("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
