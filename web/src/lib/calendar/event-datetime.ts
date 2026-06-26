export type CalendarEventWhen = { dateTime?: string; date?: string; timeZone: string };

function officeTimeZone(): string {
  return process.env.OFFICE_TIMEZONE?.trim() || "Asia/Manila";
}

function addDaysYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function parseTimeParts(time: string): { hour: number; minute: number } | null {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function toCalendarWhen(dateYmd: string, time?: string | null): CalendarEventWhen {
  const timeZone = officeTimeZone();
  const parts = time ? parseTimeParts(time) : null;
  if (parts) {
    return {
      dateTime: `${dateYmd}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00`,
      timeZone
    };
  }
  return { date: dateYmd, timeZone };
}

function addMinutesToDateTime(dateTime: string, minutes: number): string {
  const match = dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00$/);
  if (!match) return dateTime;
  const [, dateYmd, hourText, minuteText] = match;
  const totalMinutes = Number(hourText) * 60 + Number(minuteText) + minutes;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const minutesInDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const endHour = Math.floor(minutesInDay / 60);
  const endMinute = minutesInDay % 60;
  const endDate = dayOffset ? addDaysYmd(dateYmd, dayOffset) : dateYmd;
  return `${endDate}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`;
}

function compareDateTime(a: CalendarEventWhen, b: CalendarEventWhen): number {
  const aValue = a.dateTime || `${a.date}T00:00:00`;
  const bValue = b.dateTime || `${b.date}T00:00:00`;
  return aValue.localeCompare(bValue);
}

/** Google Calendar rejects identical start/end and all-day events need an exclusive end date. */
export function buildCalendarEventStartEnd(
  dateYmd: string,
  startTime?: string | null,
  endTime?: string | null
): { start: CalendarEventWhen; end: CalendarEventWhen } {
  const start = toCalendarWhen(dateYmd, startTime);

  if (start.date) {
    return {
      start,
      end: { date: addDaysYmd(dateYmd, 1), timeZone: start.timeZone }
    };
  }

  let end = endTime ? toCalendarWhen(dateYmd, endTime) : start;
  if (!end.dateTime) {
    end = {
      dateTime: addMinutesToDateTime(start.dateTime!, 60),
      timeZone: start.timeZone
    };
  } else if (compareDateTime(end, start) <= 0) {
    end = {
      dateTime: addMinutesToDateTime(start.dateTime!, 60),
      timeZone: start.timeZone
    };
  }

  return { start, end };
}

export function formatCalendarApiError(error: unknown): string {
  if (error && typeof error === "object") {
    const payload = error as {
      message?: string;
      response?: { data?: { error?: { message?: string; errors?: Array<{ message?: string }> } } };
    };
    const apiMessage = payload.response?.data?.error?.message;
    if (apiMessage) return apiMessage;
    const detail = payload.response?.data?.error?.errors?.[0]?.message;
    if (detail) return detail;
    if (payload.message) return payload.message;
  }
  return error instanceof Error ? error.message : "Calendar sync failed.";
}
