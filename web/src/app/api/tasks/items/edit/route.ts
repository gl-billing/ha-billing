import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { syncSavedItemToCalendar } from "@/lib/calendar/sync-item-after-save";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { normalizeEventFormInput, validateEventFormInput } from "@/lib/office-tasks/event-form-utils";
import {
  mergeTaskWorkDetails,
  resolveTaskType,
  validateTaskFormInput
} from "@/lib/office-tasks/task-form-utils";
import { updateEvent, updateTask, type EventFormInput, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function PATCH(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = await request.json();
    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source (Task|Event) and rowNumber are required." }, { status: 400 });
    }

    if (source === "Task") {
      const taskType = String(body.taskType || "Task");
      const taskTypeOther = body.taskTypeOther ? String(body.taskTypeOther) : "";
      const taskPrep = Array.isArray(body.taskPrep)
        ? body.taskPrep.map((value: unknown) => String(value).trim()).filter(Boolean)
        : [];

      const form: TaskFormInput = {
        clientCase: String(body.clientCase || ""),
        assignedTo: String(body.assignedTo || ""),
        dueDate: String(body.dueDate || ""),
        dueTime: body.dueTime ? String(body.dueTime) : "",
        venue: body.venue ? String(body.venue) : "",
        priority: String(body.priority || "Medium"),
        taskType: resolveTaskType(taskType, taskTypeOther),
        description: mergeTaskWorkDetails(
          String(body.description || ""),
          body.workNotes ? String(body.workNotes) : "",
          taskPrep
        ),
        previousAction: body.previousAction ? String(body.previousAction) : "",
        nextAction: body.nextAction ? String(body.nextAction) : "",
        remarks: body.remarks ? String(body.remarks) : "",
        status: String(body.status || "In Progress"),
        reminderDays: Number(body.reminderDays ?? 1),
        calendarSync: body.calendarSync === true
      };

      const validationError = validateTaskFormInput({
        clientCase: form.clientCase,
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        description: String(body.description || ""),
        taskType,
        taskTypeOther
      });
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      await updateTask(token, rowNumber, form);
      invalidateTasksDataCache(token);
      const calendar = await syncSavedItemToCalendar(
        token,
        body.itemId ? String(body.itemId) : "",
        form.calendarSync === true
      );
      const session = await getServerSession(authOptions);
      await appendTaskActivity(token, {
        user: session?.user?.email || session?.user?.name || "staff",
        action: "edit",
        source: "Task",
        itemId: body.itemId ? String(body.itemId) : "",
        clientCase: form.clientCase,
        summary: "Task edited",
        details: form.remarks?.trim() ? `Remarks: ${form.remarks.trim()}` : undefined
      });
      return NextResponse.json({
        ok: true,
        message: calendar.calendarError
          ? `Task updated. Calendar: ${calendar.calendarError}`
          : calendar.calendarEventId
            ? "Task updated and synced to Google Calendar."
            : "Task updated."
      });
    }

    const form: EventFormInput = normalizeEventFormInput({
      clientCase: String(body.clientCase || ""),
      eventDate: body.eventDate ? String(body.eventDate) : "",
      filingDeadline: body.filingDeadline ? String(body.filingDeadline) : "",
      startTime: body.startTime ? String(body.startTime) : "",
      endTime: body.endTime ? String(body.endTime) : "",
      category: String(body.category || "Hearing"),
      categoryOther: body.categoryOther ? String(body.categoryOther) : "",
      priority: String(body.priority || "Medium"),
      responsible: String(body.responsible || ""),
      venue: body.venue ? String(body.venue) : "",
      platform: body.platform ? String(body.platform) : "",
      filingMode: body.filingMode ? String(body.filingMode) : "",
      pleadingType: body.pleadingType ? String(body.pleadingType) : "",
      pleadingCaseNature: body.pleadingCaseNature ? String(body.pleadingCaseNature) : "",
      receivedDate: body.receivedDate ? String(body.receivedDate) : "",
      periodToFileDays: Number(body.periodToFileDays ?? 0),
      filingDate: body.filingDate ? String(body.filingDate) : "",
      details: String(body.details || ""),
      previousAction: body.previousAction ? String(body.previousAction) : "",
      nextAction: body.nextAction ? String(body.nextAction) : "",
      remarks: body.remarks ? String(body.remarks) : "",
      status: String(body.status || "Scheduled"),
      reminderDays: Number(body.reminderDays ?? 1),
      calendarSync: body.calendarSync === true
    });

    const validationError = validateEventFormInput(form);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!form.clientCase.trim() || !form.responsible.trim() || !form.details.trim()) {
      return NextResponse.json(
        { error: "Client/case, responsible person, and details are required." },
        { status: 400 }
      );
    }

    await updateEvent(token, rowNumber, form);
    invalidateTasksDataCache(token);
    const calendar = await syncSavedItemToCalendar(
      token,
      body.itemId ? String(body.itemId) : "",
      form.calendarSync === true
    );
    const session = await getServerSession(authOptions);
    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "edit",
      source: "Event",
      itemId: body.itemId ? String(body.itemId) : "",
      clientCase: form.clientCase,
      summary: "Event edited",
      details: form.remarks?.trim() ? `Remarks: ${form.remarks.trim()}` : undefined
    });
    return NextResponse.json({
      ok: true,
      message: calendar.calendarError
        ? `Event updated. Calendar: ${calendar.calendarError}`
        : calendar.calendarEventId
          ? "Event updated and synced to Google Calendar."
          : "Event updated."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save changes.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
