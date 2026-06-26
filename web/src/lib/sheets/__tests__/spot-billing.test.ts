import { describe, expect, it } from "vitest";
import { accumulateSpotBillingTotals } from "@/lib/sheets/spot-billing";
import {
  buildSpotBillingEmailPreview,
  spotBillingLetterFilename,
  spotBillingLetterKindForTransaction
} from "@/lib/spot-billing-letter";

describe("spot billing totals", () => {
  it("accumulates separate charge and payment transactions", () => {
    const charge = accumulateSpotBillingTotals(
      { chargeAmount: 0, paymentAmount: 0, paymentMethod: "" },
      { serviceType: "Professional Fee", transactionKind: "charge", charge: 5000, date: "2026-06-01" }
    );
    expect(charge.chargeAmount).toBe(5000);
    expect(charge.paymentAmount).toBe(0);
    expect(charge.billingStatus).toBe("Unpaid");

    const payment = accumulateSpotBillingTotals(
      { chargeAmount: charge.chargeAmount, paymentAmount: charge.paymentAmount, paymentMethod: charge.paymentMethod },
      {
        serviceType: "Professional Fee",
        transactionKind: "payment",
        payment: 5000,
        method: "Cash",
        date: "2026-06-02"
      }
    );
    expect(payment.chargeAmount).toBe(5000);
    expect(payment.paymentAmount).toBe(5000);
    expect(payment.billingStatus).toBe("Paid");

    const partial = accumulateSpotBillingTotals(
      { chargeAmount: payment.chargeAmount, paymentAmount: payment.paymentAmount, paymentMethod: payment.paymentMethod },
      { serviceType: "Document Fee", transactionKind: "charge", charge: 1500, date: "2026-06-10" }
    );
    expect(partial.chargeAmount).toBe(6500);
    expect(partial.paymentAmount).toBe(5000);
    expect(partial.billingStatus).toBe("Partial");
  });

  it("records retainer notes without amounts", () => {
    const result = accumulateSpotBillingTotals(
      { chargeAmount: 0, paymentAmount: 0, paymentMethod: "" },
      { serviceType: "Professional Fee", transactionKind: "retainer", date: "2026-06-01" }
    );
    expect(result.billingStatus).toBe("Retainer");
    expect(result.chargeAmount).toBe(0);
    expect(result.paymentAmount).toBe(0);
  });

  it("marks payment-only entries as payment recorded", () => {
    const result = accumulateSpotBillingTotals(
      { chargeAmount: 0, paymentAmount: 0, paymentMethod: "" },
      {
        serviceType: "Professional Fee",
        transactionKind: "payment",
        payment: 2500,
        method: "GCash",
        date: "2026-06-03"
      }
    );
    expect(result.paymentAmount).toBe(2500);
    expect(result.billingStatus).toBe("Payment recorded");
  });
});

describe("spot billing letterhead", () => {
  const entry = {
    spotId: "SPOT-0001",
    payerName: "Jane Smith",
    email: "jane@example.com",
    serviceDescription: "Document review",
    linkedClientCode: "",
    assignedAttorney: "Atty. Maria Hernandez",
    chargeAmount: 5000,
    paymentAmount: 2000
  };

  it("builds charge and payment email previews", () => {
    const chargeEmail = buildSpotBillingEmailPreview({
      kind: "charge",
      entry,
      transaction: { serviceType: "Professional Fee", charge: 5000, date: "2026-06-01" }
    });
    expect(chargeEmail.subject).toContain("Billing Notice");
    expect(chargeEmail.body).toContain("Atty. Maria Hernandez");
    expect(chargeEmail.body).toContain("Balance due");

    const paymentEmail = buildSpotBillingEmailPreview({
      kind: "payment",
      entry,
      transaction: {
        serviceType: "Professional Fee",
        payment: 2000,
        method: "Cash",
        date: "2026-06-02"
      }
    });
    expect(paymentEmail.subject).toContain("Acknowledgment Receipt");
    expect(paymentEmail.body).toContain("acknowledge receipt");
  });

  it("names charge and payment PDFs differently", () => {
    expect(
      spotBillingLetterFilename({
        kind: "charge",
        entry,
        transaction: { serviceType: "Professional Fee", charge: 5000, date: "2026-06-01" }
      })
    ).toContain("Spot-Charge-SPOT-0001");

    expect(
      spotBillingLetterFilename({
        kind: "payment",
        entry,
        transaction: { serviceType: "Professional Fee", payment: 2000, date: "2026-06-02" }
      })
    ).toContain("Spot-Receipt-SPOT-0001");
  });

  it("infers letter kind from transaction type", () => {
    expect(spotBillingLetterKindForTransaction({ serviceType: "Fee", transactionKind: "charge", charge: 1000 })).toBe(
      "charge"
    );
    expect(
      spotBillingLetterKindForTransaction({ serviceType: "Fee", transactionKind: "payment", payment: 1000, method: "Cash" })
    ).toBe("payment");
  });
});
