import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { syncSavedItemToCalendar } from "@/lib/calendar/sync-item-after-save";
import { sessionEntryRegistrarLabel } from "@/lib/office-tasks/entry-registrar";
import { appendTask, listRecentItems, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function GET() {
  try {
    const token = await requireSessionAccessToken();
    const items = await listRecentItems(token, 60);
    const tasks = items.filter((i) => i.source === "Task");
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as TaskFormInput;

    if (!body.clientCase?.trim() || !body.assignedTo?.trim() || !body.dueDate || !body.description?.trim()) {
      return NextResponse.json({ error: "Client/case, assignee, due date, and description are required." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const createdBy = sessionEntryRegistrarLabel(session);

    const saved = await appendTask(token, {
      ...body,
      taskType: body.taskType?.trim() || "Task"
    }, { createdBy });
    invalidateTasksDataCache(token);
    const calendar = await syncSavedItemToCalendar(token, saved.id, body.calendarSync === true);
    return NextResponse.json({
      ok: true,
      taskId: saved.id,
      sheetRow: saved.sheetRow,
      message: calendar.calendarError
        ? `Task added (${saved.id}) on Master Tasks row ${saved.sheetRow}. Calendar: ${calendar.calendarError}`
        : calendar.calendarEventId
          ? `Task added (${saved.id}) on Master Tasks row ${saved.sheetRow} and synced to Google Calendar.`
          : `Task added (${saved.id}) on Master Tasks row ${saved.sheetRow}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add task.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
