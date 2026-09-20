import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/lib/ha-config";
import { listOpenChargesFromLedger } from "@/lib/open-charges";

function entry(partial: Partial<LedgerEntry> & Pick<LedgerEntry, "sheetRow" | "type">): LedgerEntry {
  return {
    date: "2026-09-01",
    category: "Professional Fee",
    description: "Appearance fee",
    charge: 0,
    payment: 0,
    balance: 0,
    method: "",
    details: "",
    documentNumber: "",
    arSent: false,
    pdfLink: "",
    ...partial
  };
}

describe("listOpenChargesFromLedger", () => {
  it("shows full charge amount when no payment is linked", () => {
    const open = listOpenChargesFromLedger([
      entry({ sheetRow: 10, type: "Charge", charge: 5000 })
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].amount).toBe(5000);
    expect(open[0].originalAmount).toBe(5000);
  });

  it("reduces remaining balance after a partial linked payment", () => {
    const open = listOpenChargesFromLedger([
      entry({ sheetRow: 10, type: "Charge", charge: 5000 }),
      entry({
        sheetRow: 11,
        type: "Payment",
        payment: 2000,
        details: "BPI ref 123 | chargeRow:10"
      })
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].amount).toBe(3000);
    expect(open[0].originalAmount).toBe(5000);
    expect(open[0].display).toContain("left of");
  });

  it("hides fully paid linked charges", () => {
    const open = listOpenChargesFromLedger([
      entry({ sheetRow: 10, type: "Charge", charge: 5000 }),
      entry({
        sheetRow: 11,
        type: "Payment",
        payment: 5000,
        details: "chargeRow:10"
      })
    ]);
    expect(open).toHaveLength(0);
  });

  it("sums multiple partial payments against the same charge", () => {
    const open = listOpenChargesFromLedger([
      entry({ sheetRow: 8, type: "Charge", charge: 10000 }),
      entry({ sheetRow: 9, type: "Payment", payment: 2500, details: "chargeRow:8" }),
      entry({ sheetRow: 10, type: "Payment", payment: 2500, details: "partial | chargeRow:8" })
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].amount).toBe(5000);
  });

  it("ignores payments that are not linked to a charge row", () => {
    const open = listOpenChargesFromLedger([
      entry({ sheetRow: 10, type: "Charge", charge: 5000 }),
      entry({ sheetRow: 11, type: "Payment", payment: 2000, details: "unlinked payment" })
    ]);
    expect(open[0].amount).toBe(5000);
  });
});
