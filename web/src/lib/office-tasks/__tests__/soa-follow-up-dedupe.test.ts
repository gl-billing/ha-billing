import { describe, expect, it } from "vitest";
import { duplicateSoaFollowUpsToClose } from "@/lib/soa-follow-up";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

describe("SOA follow-up dedupe", () => {
  it("keeps one open SOA follow-up per client", () => {
    const caseIndex = new Map([["abc corp — sample case", "ABC"]]);
    const items = [
      makeItem({
        id: "T-1",
        clientCase: "ABC Corp — Sample case",
        details: "SOA sent — schedule collection follow-up",
        remarks: "BILLING_TRIGGER:SOA:ABC:2026-06-01",
        lastUpdated: "2026-06-01"
      }),
      makeItem({
        id: "T-2",
        rowNumber: 3,
        clientCase: "ABC Corp — Sample case",
        details: "SOA sent — schedule collection follow-up",
        remarks: "BILLING_TRIGGER:SOA:ABC:2026-06-07",
        lastUpdated: "2026-06-07"
      })
    ];

    const toClose = duplicateSoaFollowUpsToClose(items, caseIndex);
    expect(toClose.map((item) => item.id)).toEqual(["T-1"]);
  });

  it("collapses duplicate SOA tasks even when Client / Case labels differ", () => {
    const caseIndex = new Map([
      ["chicken — qualified theft", "CHICKEN"],
      ["qualified theft", "CHICKEN"],
      ["chicken", "CHICKEN"],
      ["chi", "CHICKEN"]
    ]);
    const items = [
      makeItem({
        id: "T-1",
        clientCase: "Qualified Theft",
        details: "SOA sent — schedule collection follow-up",
        remarks: "BILLING_TRIGGER:SOA:CHICKEN:2026-06-01",
        lastUpdated: "2026-06-01"
      }),
      makeItem({
        id: "T-2",
        rowNumber: 3,
        clientCase: "Chicken",
        details: "SOA sent — schedule collection follow-up",
        remarks: "BILLING_TRIGGER:SOA:CHICKEN:2026-06-02",
        lastUpdated: "2026-06-02"
      }),
      makeItem({
        id: "T-3",
        rowNumber: 4,
        clientCase: "Chicken — Qualified Theft",
        details: "SOA sent — schedule collection follow-up",
        remarks: "BILLING_TRIGGER:SOA:CHICKEN:2026-06-03",
        lastUpdated: "2026-06-03"
      })
    ];

    const toClose = duplicateSoaFollowUpsToClose(items, caseIndex);
    expect(toClose.map((item) => item.id).sort()).toEqual(["T-1", "T-2"]);
  });
});
