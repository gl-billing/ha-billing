import { describe, expect, it } from "vitest";
import { buildCalendarEventStartEnd } from "@/lib/calendar/event-datetime";

describe("buildCalendarEventStartEnd", () => {
  it("uses an exclusive next-day end for all-day events", () => {
    expect(buildCalendarEventStartEnd("2026-06-12")).toEqual({
      start: { date: "2026-06-12", timeZone: "Asia/Manila" },
      end: { date: "2026-06-13", timeZone: "Asia/Manila" }
    });
  });

  it("defaults timed events without an end to one hour", () => {
    expect(buildCalendarEventStartEnd("2026-06-12", "14:00")).toEqual({
      start: { dateTime: "2026-06-12T14:00:00", timeZone: "Asia/Manila" },
      end: { dateTime: "2026-06-12T15:00:00", timeZone: "Asia/Manila" }
    });
  });

  it("extends invalid end times to one hour after start", () => {
    expect(buildCalendarEventStartEnd("2026-06-12", "14:00", "14:00")).toEqual({
      start: { dateTime: "2026-06-12T14:00:00", timeZone: "Asia/Manila" },
      end: { dateTime: "2026-06-12T15:00:00", timeZone: "Asia/Manila" }
    });
  });
});
