import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { buildFirmNotifications } from "@/lib/office-tasks/firm-notifications";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { listTodayBirthdayClients } from "@/lib/sheets/birthday-greetings";

export async function GET() {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminEmail(session?.user?.email);
    const today = todayYmd();

    const [items, birthdays] = await Promise.all([
      getCachedAllItems(token),
      listTodayBirthdayClients(token).catch(() => [])
    ]);

    const notifications = buildFirmNotifications({
      items,
      today,
      birthdays,
      includeAdminNotices: isAdmin,
      includeMarkFiledActions: isAdmin
    });

    return NextResponse.json({
      today,
      isAdmin,
      notifications
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load notifications.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
