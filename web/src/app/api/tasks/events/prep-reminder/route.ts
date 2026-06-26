import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { createEventReminderTaskForExistingEvent } from "@/lib/office-tasks/event-follow-up";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

type Body = {
  source?: string;
  rowNumber?: number;
  id?: string;
  daysBefore?: number;
};

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as Body;
    const rowNumber = Number(body.rowNumber);
    const id = String(body.id || "").trim();

    if (body.source !== "Event" || rowNumber < 2) {
      return NextResponse.json({ error: "Valid event row is required." }, { status: 400 });
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

    const daysBefore = Number(body.daysBefore) || 3;
    const result = await createEventReminderTaskForExistingEvent(token, event, daysBefore);
    invalidateTasksDataCache(token);

    return NextResponse.json({
      ok: true,
      taskId: result.taskId,
      created: result.created,
      message: result.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create prep checklist.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
