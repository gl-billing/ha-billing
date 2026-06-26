import { describe, expect, it } from "vitest";
import {
  buildMonthCloseChecklist,
  computeAllocationSplits,
  DEFAULT_ALLOCATION_PERCENTS,
  isAppearanceFeePayment,
  isOfficeSplitPayment,
  isUnclassifiedIncomePayment,
  monthCloseHasBlockers,
  monthCloseHasWarnings,
  readAllocationSettings,
  summarizeAppearanceFeesByAttorney,
  summarizeOfficeIncomeSources
} from "@/lib/firm-allocation";
import { buildPaymentLedgerFields, normalizePaymentIncomeType } from "@/lib/payment-income";

describe("firm allocation", () => {
  it("detects appearance fee payments", () => {
    expect(isAppearanceFeePayment("Appearance Fee", "Hearing", "")).toBe(true);
    expect(isAppearanceFeePayment("Acceptance Fee", "Payment", "")).toBe(false);
  });

  it("includes only acceptance, professional, and notarial ledger payments in office split", () => {
    expect(isOfficeSplitPayment("Acceptance Fee", "Intake", "")).toBe(true);
    expect(isOfficeSplitPayment("Payment", "Professional fee — retainer", "")).toBe(true);
    expect(isOfficeSplitPayment("Notarial Fee", "Acknowledgment", "")).toBe(true);
    expect(isOfficeSplitPayment("Payment", "Notarization payment", "")).toBe(true);
    expect(isOfficeSplitPayment("Filing Fee", "E-filing", "")).toBe(false);
    expect(isOfficeSplitPayment("Appearance Fee", "Hearing", "")).toBe(false);
    expect(isOfficeSplitPayment("Payment", "Payment Received", "")).toBe(false);
    expect(isOfficeSplitPayment("Transportation", "Bus fare", "")).toBe(false);
  });

  it("splits income across buckets totaling 100%", () => {
    const splits = computeAllocationSplits(1000, {
      expenses: 60,
      savings: 10,
      travel: 20,
      emergency: 10
    });
    expect(splits.expenses).toBe(600);
    expect(splits.savings).toBe(100);
    expect(splits.travel).toBe(200);
    expect(splits.emergency).toBe(100);
  });

  it("reads defaults from empty settings map", () => {
    const settings = readAllocationSettings(new Map());
    expect(settings.percentValid).toBe(true);
    expect(settings.percents.expenses).toBe(60);
  });

  it("groups appearance fees by assigned attorney", () => {
    const groups = summarizeAppearanceFeesByAttorney([
      {
        id: "a1",
        date: "Jun 1, 2026",
        clientCode: "RET-ENA",
        clientName: "Client A",
        assignedAttorney: "Jas",
        label: "Appearance fee",
        amount: 2500
      },
      {
        id: "a2",
        date: "Jun 2, 2026",
        clientCode: "RET-BBB",
        clientName: "Client B",
        assignedAttorney: "Jas",
        label: "Appearance fee",
        amount: 1500
      }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.assignedAttorney).toBe("Jas");
    expect(groups[0]?.total).toBe(4000);
  });

  it("flags generic payments as unclassified income", () => {
    expect(isUnclassifiedIncomePayment("Payment", "Payment Received", "")).toBe(true);
    expect(isUnclassifiedIncomePayment("Filing Fee", "E-filing", "")).toBe(true);
    expect(isUnclassifiedIncomePayment("Acceptance Fee", "Intake", "")).toBe(false);
    expect(isUnclassifiedIncomePayment("Transportation", "Bus fare", "")).toBe(false);
  });

  it("summarizes office income sources", () => {
    const breakdown = summarizeOfficeIncomeSources([
      {
        id: "1",
        date: "Jun 1, 2026",
        source: "payment",
        clientCode: "A",
        clientName: "A",
        label: "Acceptance fee",
        amount: 1000
      },
      {
        id: "2",
        date: "Jun 2, 2026",
        source: "notarization",
        clientCode: "NOTARIAL",
        clientName: "Walk-in",
        label: "Notarization · NR-1",
        amount: 500
      }
    ]);
    expect(breakdown.acceptance).toBe(1000);
    expect(breakdown.notarial).toBe(500);
  });

  it("builds payment ledger fields from income type", () => {
    expect(buildPaymentLedgerFields("Acceptance Fee")).toEqual({
      category: "Acceptance Fee",
      description: "Acceptance Fee"
    });
    expect(normalizePaymentIncomeType("payment for professional fee")).toBe("Professional Fee");
  });

  it("builds month close checklist with blockers and warnings", () => {
    const checklist = buildMonthCloseChecklist({
      year: 2026,
      month: 6,
      monthLabel: "June 2026",
      settings: readAllocationSettings(new Map()),
      lines: [],
      totalIncome: 0,
      splits: computeAllocationSplits(0, DEFAULT_ALLOCATION_PERCENTS),
      sourceBreakdown: { acceptance: 0, professional: 0, notarial: 0 },
      appearanceFees: [],
      appearanceFeeByAttorney: [],
      totalAppearanceFees: 0,
      unclassifiedIncome: [
        {
          id: "u1",
          date: "Jun 1, 2026",
          clientCode: "RET-A",
          clientName: "A",
          assignedAttorney: "",
          category: "Payment",
          label: "Payment Received",
          amount: 1000,
          reason: "Generic payment",
          sheetRow: 5
        }
      ],
      totalUnclassifiedIncome: 1000,
      monthClosed: false,
      rollingMonths: [],
      closeChecklist: [],
      bucketBalances: {
        opening: { expenses: 0, savings: 0, travel: 0, emergency: 0 },
        current: { expenses: 0, savings: 0, travel: 0, emergency: 0 },
        allocatedThisMonth: { expenses: 0, savings: 0, travel: 0, emergency: 0 }
      },
      bucketAdjustments: []
    });
    expect(monthCloseHasWarnings(checklist)).toBe(true);
    expect(monthCloseHasBlockers(checklist)).toBe(false);
  });
});
