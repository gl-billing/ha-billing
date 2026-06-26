import { describe, expect, it } from "vitest";
import {
  walkInBillingLedgerDescription,
  walkInHasTransferableBilling
} from "@/lib/sheets/walk-ins";
import type { WalkInClient } from "@/lib/gl-config";

function walkIn(partial: Partial<WalkInClient>): WalkInClient {
  return {
    walkInId: "WALK-0001",
    dateAdded: "2026-06-01",
    name: "Maria Cruz",
    matter: "Consultation",
    phone: "",
    email: "",
    notes: "",
    status: "Active",
    promotedClientCode: "",
    chargeAmount: 0,
    paymentAmount: 0,
    paymentMethod: "",
    billingDate: "",
    billingStatus: "",
    serviceType: "",
    rowNumber: 2,
    ...partial
  };
}

describe("walkInHasTransferableBilling", () => {
  it("returns false for retainer visits", () => {
    expect(walkInHasTransferableBilling(walkIn({ billingStatus: "Retainer" }))).toBe(false);
  });

  it("returns true when a charge was recorded", () => {
    expect(walkInHasTransferableBilling(walkIn({ chargeAmount: 2500, billingStatus: "Paid" }))).toBe(true);
  });
});

describe("walkInBillingLedgerDescription", () => {
  it("includes walk-in id and service type", () => {
    expect(
      walkInBillingLedgerDescription(
        walkIn({ serviceType: "Professional Fee", matter: "Demand letter consult" })
      )
    ).toBe("Professional Fee — Demand letter consult (WALK-0001)");
  });
});
