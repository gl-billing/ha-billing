import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { canAccessBilling } from "@/lib/app-access";
import { syncSavedItemToCalendar } from "@/lib/calendar/sync-item-after-save";
import { createEventLinkedTasks } from "@/lib/office-tasks/event-follow-up";
import { resolvePleadingEventResponsible } from "@/lib/office-tasks/event-client-attorney";
import { applyEventMatterBillingCharges } from "@/lib/office-tasks/event-matter-billing";
import { appendSucceedingHearingEvents } from "@/lib/office-tasks/event-pto-schedule";
import { sessionEntryRegistrarLabel } from "@/lib/office-tasks/entry-registrar";
import { normalizeEventFormInput, validateEventFormInput } from "@/lib/office-tasks/event-form-utils";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { appendEvent, listRecentItems, type EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function GET() {
  try {
    const token = await requireSessionAccessToken();
    const items = await listRecentItems(token, 60);
    const events = items.filter((i) => i.source === "Event");
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load events.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = normalizeEventFormInput((await request.json()) as EventFormInput);

    if (!body.clientCase?.trim() || !body.responsible?.trim() || !body.details?.trim()) {
      return NextResponse.json({ error: "Client/case, responsible person, and details are required." }, { status: 400 });
    }

    const validationError = validateEventFormInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const ptoRows = body.fromPretrialOrder ? body.succeedingHearingDates || [] : [];
    const session = await getServerSession(authOptions);
    const createdBy = sessionEntryRegistrarLabel(session);

    if (ptoRows.length > 0) {
      const { batchId, eventIds } = await appendSucceedingHearingEvents(token, body, ptoRows, { createdBy });
      const calendarNotes: string[] = [];
      if (body.calendarSync === true) {
        for (const eventId of eventIds) {
          const calendar = await syncSavedItemToCalendar(token, eventId, true);
          if (calendar.calendarError) calendarNotes.push(`${eventId}: ${calendar.calendarError}`);
        }
      }
      invalidateTasksDataCache(token);

      const message = `Created ${eventIds.length} hearing${eventIds.length === 1 ? "" : "s"} from pre-trial order (${batchId}). IDs: ${eventIds.join(", ")}.${
        calendarNotes.length ? ` Calendar: ${calendarNotes.join("; ")}` : body.calendarSync ? " Synced to Google Calendar." : ""
      }`;

      return NextResponse.json({
        ok: true,
        eventIds,
        ptoBatchId: batchId,
        message
      });
    }

    const saved = await appendEvent(token, body, { createdBy });
    invalidateTasksDataCache(token);
    const roster = await getActiveEmployeeNames(token);
    const responsible = await resolvePleadingEventResponsible(
      token,
      body.clientCase,
      body.responsible,
      roster
    );
    const bodyWithLawyer = { ...body, responsible };
    const { followUpTaskId, reminderTaskId } = await createEventLinkedTasks(token, saved.id, bodyWithLawyer);

    let billingMessages: string[] = [];
    if (body.billAppearanceFee || body.billPleadingFee) {
      if (!canAccessBilling(session?.user?.email)) {
        return NextResponse.json(
          { error: "Billing access is required to add matter charges from events." },
          { status: 403 }
        );
      }
      billingMessages = await applyEventMatterBillingCharges(token, {
        eventId: saved.id,
        form: bodyWithLawyer
      });
    }

    const calendar = await syncSavedItemToCalendar(token, saved.id, body.calendarSync === true);

    const parts = [`Hearing/event added (${saved.id}) on Hearings & Events row ${saved.sheetRow}`];
    if (followUpTaskId) parts.push(`follow-up task ${followUpTaskId}`);
    if (reminderTaskId) parts.push(`reminder task ${reminderTaskId}`);
    if (billingMessages.length) parts.push(billingMessages.join("; "));
    if (calendar.calendarEventId) parts.push("synced to Google Calendar");
    if (calendar.calendarError) parts.push(`calendar: ${calendar.calendarError}`);

    return NextResponse.json({
      ok: true,
      eventId: saved.id,
      sheetRow: saved.sheetRow,
      followUpTaskId,
      reminderTaskId,
      calendarEventId: calendar.calendarEventId,
      message: `${parts[0]}.${parts.length > 1 ? ` ${parts.slice(1).join("; ")}.` : ""}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add event.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
