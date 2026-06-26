import { normalizeEventFormInput } from "@/lib/office-tasks/event-form-utils";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

export function eventFormInputFromOfficeItem(item: OfficeItem): EventFormInput {
  return normalizeEventFormInput({
    clientCase: item.clientCase,
    eventDate: item.eventDate || "",
    filingDeadline: item.filingDeadline || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    category: item.category,
    priority: item.priority,
    responsible: item.assignedTo,
    venue: item.venue,
    platform: item.platform,
    filingMode: item.filingMode,
    pleadingType: item.pleadingType,
    pleadingCaseNature: item.pleadingCaseNature,
    receivedDate: item.receivedDate || "",
    periodToFileDays: item.periodToFileDays || 0,
    filingDate: item.filingDate || "",
    details: item.details,
    previousAction: item.previousAction,
    nextAction: item.nextAction,
    remarks: item.remarks,
    status: item.status,
    reminderDays: item.reminderDays,
    calendarSync: item.calendarSync
  });
}
