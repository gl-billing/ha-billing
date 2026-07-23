import { describe, expect, it } from "vitest";
import { shouldCreatePleadingFollowUpTask } from "@/lib/office-tasks/event-follow-up";

describe("shouldCreatePleadingFollowUpTask", () => {
  it("creates follow-up for pleading events with a filing deadline by default", () => {
    expect(
      shouldCreatePleadingFollowUpTask("Court Filing", {
        filingDeadline: "2026-08-01",
        createFollowUpTask: undefined
      })
    ).toBe(true);
  });

  it("skips non-pleading categories", () => {
    expect(
      shouldCreatePleadingFollowUpTask("Hearing", {
        filingDeadline: "2026-08-01",
        createFollowUpTask: true
      })
    ).toBe(false);
  });

  it("honors explicit opt-out", () => {
    expect(
      shouldCreatePleadingFollowUpTask("Submission", {
        filingDeadline: "2026-08-01",
        createFollowUpTask: false
      })
    ).toBe(false);
  });

  it("requires a filing deadline", () => {
    expect(
      shouldCreatePleadingFollowUpTask("Deadline", {
        filingDeadline: "",
        createFollowUpTask: true
      })
    ).toBe(false);
  });
});
