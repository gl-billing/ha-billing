import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { initializeInteractivePrepChecklistFromTaskRow } from "@/lib/office-tasks/event-follow-up";
import { looksLikePrepReminderTask } from "@/lib/office-tasks/prep-task-event-link";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { initializeGenericTaskPrepChecklist } from "@/lib/office-tasks/task-prep-checklist";
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

    if (body.source !== "Task" || rowNumber < 2) {
      return NextResponse.json({ error: "Valid task row is required." }, { status: 400 });
    }

    const items = await collectAllItems(token);
    const task = items.find(
      (item) =>
        item.source === "Task" &&
        item.rowNumber === rowNumber &&
        (!id || item.id === id)
    );

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const result = looksLikePrepReminderTask(task)
      ? await initializeInteractivePrepChecklistFromTaskRow(token, task)
      : await initializeGenericTaskPrepChecklist(token, task);
    invalidateTasksDataCache(token);

    return NextResponse.json({
      ok: true,
      taskId: result.taskId,
      total: result.total,
      message: result.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enable prep checklist.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
