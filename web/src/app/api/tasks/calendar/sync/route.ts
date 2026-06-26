import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { pullCalendarChanges, syncOpenItemsToCalendar } from "@/lib/calendar/sync";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as {
      action?: "push-all" | "push-upcoming" | "pull";
      todayYmd?: string;
    };
    const action = body.action || "push-upcoming";
    const today = body.todayYmd || new Date().toISOString().slice(0, 10);
    const items = await collectAllItems(accessToken);

    if (action === "pull") {
      const result = await pullCalendarChanges(accessToken, items);
      return NextResponse.json({
        ok: true,
        message: `Pulled calendar changes — ${result.updated} updated, ${result.cancelled} cancelled.`,
        ...result
      });
    }

    const result = await syncOpenItemsToCalendar(accessToken, items, {
      upcomingOnly: action === "push-upcoming",
      todayYmd: today
    });

    return NextResponse.json({
      ok: true,
      message:
        result.errors.length === 0
          ? `Synced ${result.pushed} item(s) to Google Calendar.`
          : `Synced ${result.pushed} item(s). ${result.errors.length} error(s).`,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar sync failed.";
    const hint = /calendar/i.test(message)
      ? " Sign out and sign in again to grant Calendar access, and set GOOGLE_CALENDAR_ID in env."
      : "";
    return NextResponse.json({ error: message + hint }, { status: 500 });
  }
}
