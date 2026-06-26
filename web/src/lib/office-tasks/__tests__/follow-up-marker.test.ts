import { describe, expect, it } from "vitest";
import {
  applyFollowUpWithNote,
  displayRemarks,
  splitRemarksForFollowUp
} from "@/lib/office-tasks/follow-up-marker";

describe("applyFollowUpWithNote", () => {
  it("stores user note with hidden follow-up marker", () => {
    const saved = applyFollowUpWithNote("", "Waiting", "Waiting for Dr. Batican's reply");
    expect(displayRemarks(saved)).toBe("Waiting for Dr. Batican's reply");
    expect(saved).toContain("GL_FOLLOW_UP:Waiting");
  });

  it("preserves internal remark markers when updating note", () => {
    const existing = "Old note\nPREP_CHECKLIST:{\"items\":[]}\nGL_FOLLOW_UP:Started";
    const saved = applyFollowUpWithNote(existing, "Waiting", "Already started — waiting for court");
    expect(displayRemarks(saved)).toBe("Already started — waiting for court");
    expect(saved).toContain("PREP_CHECKLIST:");
    expect(saved).toContain("GL_FOLLOW_UP:Waiting");
  });

  it("splits user text from internal lines", () => {
    const split = splitRemarksForFollowUp("Client follow-up\nBILLING_TRIGGER:CHARGE:123");
    expect(split.userText).toBe("Client follow-up");
    expect(split.internalLines).toEqual(["BILLING_TRIGGER:CHARGE:123"]);
  });
});
