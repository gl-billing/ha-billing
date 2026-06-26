import { describe, expect, it } from "vitest";
import { isScheduleConfirmationEvent, isScheduleConfirmationCategory, isScheduleConfirmationPlatform } from "@/lib/office-tasks/event-form-utils";
import { buildScheduleConfirmationEmailPreview } from "@/lib/office-tasks/schedule-confirmation";

describe("schedule confirmation", () => {
  it("allows meeting-style events for any platform", () => {
    expect(isScheduleConfirmationEvent({
      source: "Event",
      category: "Consultation",
      platform: "Google Meet"
    })).toBe(true);
    expect(isScheduleConfirmationCategory("Meeting")).toBe(true);
    expect(isScheduleConfirmationCategory("Hearing")).toBe(false);
    expect(isScheduleConfirmationPlatform("Zoom")).toBe(true);
    expect(
      isScheduleConfirmationEvent({
        source: "Event",
        category: "Meeting",
        platform: "In person"
      })
    ).toBe(true);
    expect(
      isScheduleConfirmationEvent({
        source: "Event",
        category: "Hearing",
        platform: "Google Meet"
      })
    ).toBe(false);
  });

  it("builds a premium branded confirmation email with meet link", () => {
    const preview = buildScheduleConfirmationEmailPreview({
      item: {
        category: "Consultation",
        clientCase: "SMITH — John Smith — Labor case",
        date: "2026-06-12",
        eventDate: "2026-06-12",
        startTime: "14:00",
        endTime: "15:00",
        venue: "",
        platform: "Google Meet",
        details: "Initial consultation regarding employment dispute.",
        assignedTo: "Andrea Aguanta"
      },
      clientName: "John Smith",
      preferredGreeting: "John",
      meetLink: "https://meet.google.com/abc-defg-hij"
    });

    expect(preview.subject).toContain("Schedule confirmation");
    expect(preview.subject).toContain("Consultation");
    expect(preview.html).toContain("meet.google.com/abc-defg-hij");
    expect(preview.html).toContain("Open meeting link");
    expect(preview.html).toContain("/brand/logo.png");
    expect(preview.body).toContain("Dear Sir/Ma'am John");
  });
});
