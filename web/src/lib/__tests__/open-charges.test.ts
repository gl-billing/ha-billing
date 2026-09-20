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

  it("reduces remaining when an unlinked payment matches the charge description", () => {
    const open = listOpenChargesFromLedger([
      entry({
        sheetRow: 10,
        type: "Charge",
        category: "Appearance Fee",
        description: "Appearance fee — hearing",
        charge: 5000
      }),
      entry({
        sheetRow: 11,
        type: "Payment",
        category: "Appearance Fee",
        description: "Appearance fee — hearing",
        payment: 2000,
        details: "BPI ref"
      })
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].amount).toBe(3000);
  });

  it("matches unlinked payments by income type when descriptions differ slightly", () => {
    const open = listOpenChargesFromLedger([
      entry({
        sheetRow: 10,
        type: "Charge",
        category: "Appearance Fee",
        description: "RTC Branch 45",
        charge: 8000
      }),
      entry({
        sheetRow: 11,
        type: "Payment",
        category: "Appearance Fee",
        description: "Appearance Fee",
        payment: 3000
      })
    ]);
    expect(open).toHaveLength(1);
    expect(open[0].amount).toBe(5000);
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

  it("does not reduce a charge for a generic unlinked payment with no matching income type", () => {
    const open = listOpenChargesFromLedger([
      entry({
        sheetRow: 10,
        type: "Charge",
        category: "Filing Fee",
        description: "Motion filing",
        charge: 5000
      }),
      entry({
        sheetRow: 11,
        type: "Payment",
        category: "Payment",
        description: "Payment Received",
        payment: 2000,
        details: "unlinked payment"
      })
    ]);
    expect(open[0].amount).toBe(5000);
  });

  it("applies an unlinked payment to the latest matching prior charge", () => {
    const open = listOpenChargesFromLedger([
      entry({
        sheetRow: 8,
        type: "Charge",
        category: "Appearance Fee",
        description: "Hearing 1",
        charge: 5000
      }),
      entry({
        sheetRow: 9,
        type: "Charge",
        category: "Appearance Fee",
        description: "Hearing 2",
        charge: 5000
      }),
      entry({
        sheetRow: 10,
        type: "Payment",
        category: "Appearance Fee",
        description: "Appearance Fee",
        payment: 2000
      })
    ]);
    const byRow = new Map(open.map((c) => [c.sheetRow, c.amount]));
    expect(byRow.get(8)).toBe(5000);
    expect(byRow.get(9)).toBe(3000);
  });
});
