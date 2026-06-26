import { describe, expect, it } from "vitest";
import {
  intakeAdminTaskActionLabel,
  isIntakeConflictCheckTask,
  isIntakeEngagementDocumentTask,
  parseEngagementDocumentFromTask
} from "@/lib/intake-admin-tasks";

describe("intake admin tasks", () => {
  it("detects engagement and conflict tasks", () => {
    expect(isIntakeEngagementDocumentTask("Prepare and send contract of legal services (acceptance fee)")).toBe(true);
    expect(isIntakeEngagementDocumentTask("Prepare and send retainership agreement (hourly)")).toBe(true);
    expect(isIntakeConflictCheckTask("Complete conflict check")).toBe(true);
    expect(isIntakeConflictCheckTask("Call court to confirm")).toBe(false);
  });

  it("parses document type from task descriptions", () => {
    expect(parseEngagementDocumentFromTask("Prepare and send contract of legal services (acceptance fee)")).toEqual({
      documentType: "contract",
      feeType: "acceptance"
    });
    expect(parseEngagementDocumentFromTask("Prepare and send retainership agreement (flat rate)")).toEqual({
      documentType: "engagement",
      feeType: "flat"
    });
  });

  it("labels row actions", () => {
    expect(intakeAdminTaskActionLabel("Prepare and send contract of legal services (acceptance fee)")).toBe(
      "Send contract"
    );
    expect(intakeAdminTaskActionLabel("Prepare and send retainership agreement (retainer)")).toBe("Send agreement");
    expect(intakeAdminTaskActionLabel("Complete conflict check")).toBe("Review conflicts");
  });
});
