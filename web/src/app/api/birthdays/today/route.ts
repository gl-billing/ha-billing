import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { todayYmd } from "@/lib/office-tasks/date-only";
import { listTodayBirthdayClients } from "@/lib/sheets/birthday-greetings";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const clients = await listTodayBirthdayClients(accessToken);
    return NextResponse.json({ today: todayYmd(), clients });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not load today's birthdays.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
