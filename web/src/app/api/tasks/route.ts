import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { syncSavedItemToCalendar } from "@/lib/calendar/sync-item-after-save";
import { sessionEntryRegistrarLabel } from "@/lib/office-tasks/entry-registrar";
import { appendTask, listRecentItems, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { createLetterCorrespondenceTasks } from "@/lib/office-tasks/letter-task-automation";
import { isLetterCorrespondenceTaskType } from "@/lib/office-tasks/letter-task-utils";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { resolveJasAssignee } from "@/lib/office-tasks/task-assignees";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";

export async function GET() {
  try {
    const token = await requireSessionAccessToken();
    const items = await listRecentItems(token, 60);
    const tasks = items.filter((i) => i.source === "Task");
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks.";
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

    if (body.liaisonConfidential && !isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Only admin may create confidential liaison tasks." }, { status: 403 });
    }

    let assignedTo = body.assignedTo?.trim() || "";
    if (body.liaisonConfidential) {
      const roster = await getActiveEmployeeNames(token);
      assignedTo = resolveJasAssignee(roster);
    }

    const taskType = body.taskType?.trim() || "Task";
    const letterInput = body.letterCorrespondence;
    const saved =
      isLetterCorrespondenceTaskType(taskType) && letterInput
        ? await createLetterCorrespondenceTasks(
            token,
            { ...body, assignedTo, taskType },
            letterInput,
            createdBy
          )
        : await appendTask(
            token,
            {
              ...body,
              assignedTo,
              taskType,
              liaisonConfidential: body.liaisonConfidential === true
            },
            { createdBy }
          ).then((row) => ({
            draftTaskId: row.id,
            sheetRow: row.sheetRow,
            message: `Task added (${row.id}) on Master Tasks row ${row.sheetRow}.`
          }));

    invalidateTasksDataCache(token);
    const calendar = body.liaisonConfidential
      ? { calendarEventId: null, calendarError: null }
      : await syncSavedItemToCalendar(token, saved.draftTaskId, body.calendarSync === true);
    return NextResponse.json({
      ok: true,
      taskId: saved.draftTaskId,
      serveTaskId: "serveTaskId" in saved ? saved.serveTaskId : undefined,
      fieldDispatchId: "fieldDispatchId" in saved ? saved.fieldDispatchId : undefined,
      sheetRow: saved.sheetRow,
      message: calendar.calendarError
        ? `${saved.message} Calendar: ${calendar.calendarError}`
        : calendar.calendarEventId
          ? `${saved.message} Synced to Google Calendar.`
          : saved.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add task.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
