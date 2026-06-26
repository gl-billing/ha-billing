import { describe, expect, it } from "vitest";
import {
  billingAdminTaskActionLabel,
  isBillingChargeTask,
  isBillingPaymentTask,
  parseBillingTriggerKind
} from "@/lib/billing-admin-tasks";

describe("billing admin tasks", () => {
  it("offers guided workflow for charge and payment only", () => {
    expect(billingAdminTaskActionLabel("BILLING_TRIGGER:CHARGE:ABC:2026-06-01")).toBe("Review charge");
    expect(billingAdminTaskActionLabel("BILLING_TRIGGER:PAYMENT:ABC:2026-06-01")).toBe("Confirm payment");
    expect(billingAdminTaskActionLabel("BILLING_TRIGGER:SOA:ABC:2026-06-01")).toBeNull();
    expect(billingAdminTaskActionLabel("BILLING_TRIGGER:AR:ABC:2026-06-01")).toBeNull();
  });

  it("parses trigger kinds from remarks", () => {
    expect(parseBillingTriggerKind("BILLING_TRIGGER:CHARGE:ABC:2026-06-01")).toBe("charge");
    expect(isBillingChargeTask("BILLING_TRIGGER:CHARGE:ABC:2026-06-01")).toBe(true);
    expect(isBillingPaymentTask("BILLING_TRIGGER:PAYMENT:ABC:2026-06-01")).toBe(true);
  });
});
