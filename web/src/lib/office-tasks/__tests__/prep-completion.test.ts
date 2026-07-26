import { describe, expect, it } from "vitest";
import {
  isPreparationTask,
  parsePrepDoneNotice,
  prepDoneNoticeMarker
} from "@/lib/office-tasks/prep-completion-core";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

describe("prep completion", () => {
  it("detects filing prep tasks", () => {
    expect(
      isPreparationTask({
        source: "Task",
        category: "Filing prep",
        details: "Filing prep for initiatory pleading",
        remarks: "EVENT_REMINDER:E-1"
      })
    ).toBe(true);
    expect(
      isPreparationTask({
        source: "Task",
        category: "Task",
        details: "Draft memo",
        remarks: ""
      })
    ).toBe(false);
  });

  it("stores and parses prep done notice markers", () => {
    const marker = prepDoneNoticeMarker("Liaison Officer", "2026-06-14");
    expect(marker).toContain("PREP_DONE_NOTICE:Liaison Officer:2026-06-14");
    expect(parsePrepDoneNotice(`linked\n${marker}`)).toEqual({
      staffName: "Liaison Officer",
      dateYmd: "2026-06-14"
    });
  });
});
