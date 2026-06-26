import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { initializeHearingPrepChecklistOnEvent } from "@/lib/office-tasks/hearing-prep-checklist";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

type Body = {
  source?: string;
  rowNumber?: number;
  id?: string;
};

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as Body;
    const rowNumber = Number(body.rowNumber);
    const id = String(body.id || "").trim();

    if (body.source !== "Event" || rowNumber < 2) {
      return NextResponse.json({ error: "Valid hearing event row is required." }, { status: 400 });
    }

    const items = await collectAllItems(token);
    const event = items.find(
      (item) =>
        item.source === "Event" &&
        item.rowNumber === rowNumber &&
        (!id || item.id === id)
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const result = await initializeHearingPrepChecklistOnEvent(token, event);
    invalidateTasksDataCache(token);

    return NextResponse.json({
      ok: true,
      eventId: result.eventId,
      total: result.total,
      message: `Hearing prep checklist enabled (${result.total} items). Expand the checklist below.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enable hearing prep checklist.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
