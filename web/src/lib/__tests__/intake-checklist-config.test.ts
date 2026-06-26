import { describe, expect, it } from "vitest";
import {
  engagementDocumentTaskDescription,
  feeTypeOptionsForDocument,
  normalizeIntakeChecklistInput,
  normalizeIntakeFeeType,
  previewIntakeTasks
} from "@/lib/intake-checklist-config";

describe("intake checklist config", () => {
  it("builds retainership task by fee type", () => {
    expect(engagementDocumentTaskDescription("engagement", "hourly")).toBe(
      "Prepare and send retainership agreement (hourly)"
    );
  });

  it("builds contract task for acceptance fee", () => {
    expect(engagementDocumentTaskDescription("contract", "acceptance")).toBe(
      "Prepare and send contract of legal services (acceptance fee)"
    );
  });

  it("limits fee options by document type", () => {
    expect(feeTypeOptionsForDocument("contract").map((row) => row.value)).toEqual(["acceptance"]);
    expect(feeTypeOptionsForDocument("engagement").map((row) => row.value)).toEqual([
      "retainer",
      "hourly",
      "flat"
    ]);
  });

  it("previews selected intake tasks", () => {
    expect(
      previewIntakeTasks({
        engagementLetter: true,
        documentType: "engagement",
        feeType: "flat",
        scheduleInitialConference: false
      })
    ).toEqual(["Prepare and send retainership agreement (flat rate)"]);
  });

  it("normalizes invalid fee type for document", () => {
    expect(normalizeIntakeFeeType("contract", "hourly")).toBe("acceptance");
  });

  it("maps legacy initialConference to scheduleInitialConference", () => {
    expect(
      normalizeIntakeChecklistInput({
        engagementLetter: true,
        initialConference: true
      })?.scheduleInitialConference
    ).toBe(true);
  });
});
