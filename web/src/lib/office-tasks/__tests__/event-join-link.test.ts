import { describe, expect, it } from "vitest";
import {
  buildPersistedEventJoinFields,
  eventJoinLinkLabel,
  eventVenueDisplay,
  resolveEventJoinUrl,
  shouldShowEventJoinLink
} from "@/lib/office-tasks/event-join-link";

describe("event join link", () => {
  it("resolves URLs from venue or details", () => {
    expect(
      resolveEventJoinUrl({
        venue: "https://meet.google.com/abc-defg-hij",
        details: "",
        platform: "Google Meet"
      })
    ).toBe("https://meet.google.com/abc-defg-hij");

    expect(
      resolveEventJoinUrl({
        venue: "RTC Davao",
        details: "Join: https://zoom.us/j/123456789",
        platform: "Zoom"
      })
    ).toBe("https://zoom.us/j/123456789");
  });

  it("shows join link for schedule confirmation events with a URL", () => {
    expect(
      shouldShowEventJoinLink({
        source: "Event",
        category: "Consultation",
        platform: "Zoom",
        venue: "https://zoom.us/j/123456789",
        details: ""
      })
    ).toBe(true);

    expect(
      shouldShowEventJoinLink({
        source: "Event",
        category: "Consultation",
        platform: "Zoom",
        venue: "",
        details: ""
      })
    ).toBe(false);

    expect(
      shouldShowEventJoinLink({
        source: "Event",
        category: "Hearing",
        platform: "Zoom",
        venue: "https://zoom.us/j/123",
        details: ""
      })
    ).toBe(false);
  });

  it("hides duplicate venue when it is only the join URL", () => {
    const url = "https://meet.google.com/abc-defg-hij";
    expect(eventVenueDisplay(url, url)).toBe("");
    expect(eventVenueDisplay("RTC Davao Branch 12", url)).toBe("RTC Davao Branch 12");
  });

  it("builds persisted venue/details for auto-generated meet links", () => {
    expect(buildPersistedEventJoinFields({ venue: "", details: "" }, "https://meet.google.com/abc-defg-hij")).toEqual({
      venue: "https://meet.google.com/abc-defg-hij",
      details: ""
    });

    expect(
      buildPersistedEventJoinFields(
        { venue: "Conference room", details: "Bring ID" },
        "https://meet.google.com/abc-defg-hij"
      )
    ).toEqual({
      venue: "Conference room",
      details: "Bring ID\nMeeting link: https://meet.google.com/abc-defg-hij"
    });
  });

  it("labels platforms for card display", () => {
    expect(eventJoinLinkLabel("Google Meet")).toBe("Join via Google Meet");
    expect(eventJoinLinkLabel("Zoom")).toBe("Join via Zoom");
  });
});
