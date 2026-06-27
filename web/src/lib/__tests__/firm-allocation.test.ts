import { describe, expect, it } from "vitest";
import { resolveAcceptanceFeeAssociateFromClient } from "@/lib/assigned-lawyers";
import {
  buildMonthCloseChecklist,
  computeAcceptanceFeeShares,
  computeAllocationSplits,
  computePleadingFeeShares,
  DEFAULT_ALLOCATION_PERCENTS,
  isAcceptanceFeePayment,
  isAppearanceFeePayment,
  isOfficeSplitPayment,
  isPleadingFeePayment,
  isUnclassifiedIncomePayment,
  monthCloseHasBlockers,
  monthCloseHasWarnings,
  readAllocationSettings,
  summarizeAcceptanceFeeSharing,
  summarizeAppearanceFeesByAttorney,
  summarizeOfficeIncomeSources,
  summarizePleadingFeeSharing
} from "@/lib/firm-allocation";
import { ACCEPTANCE_FEE_SHARE_PERCENTS, MANAGING_PARTNER, PLEADING_FEE_SHARE_PERCENTS } from "@/lib/firm-team-config";
import { buildPaymentLedgerFields, normalizePaymentIncomeType } from "@/lib/payment-income";

function emptyAcceptanceReportFields() {
  return {
    acceptanceFees: [],
    acceptanceFeeSharing: summarizeAcceptanceFeeSharing([]),
    totalAcceptanceFees: 0,
    totalAcceptanceFirmShare: 0,
    pleadingFees: [],
    pleadingFeeSharing: summarizePleadingFeeSharing([]),
    totalPleadingFees: 0,
    totalPleadingFirmShare: 0
  };
}

describe("firm allocation", () => {
  it("detects appearance, pleading, and acceptance fee payments", () => {
    expect(isAppearanceFeePayment("Appearance Fee", "Hearing", "")).toBe(true);
    expect(isAppearanceFeePayment("Acceptance Fee", "Payment", "")).toBe(false);
    expect(isPleadingFeePayment("Pleading Fee", "Drafting pleading fee", "")).toBe(true);
    expect(isPleadingFeePayment("Appearance Fee", "Hearing", "")).toBe(false);
    expect(isAcceptanceFeePayment("Acceptance Fee", "Intake", "")).toBe(true);
    expect(isAcceptanceFeePayment("Appearance Fee", "Hearing", "")).toBe(false);
  });

  it("splits pleading fees 20/30/50 or 100% to drafter when sole lawyer", () => {
    expect(computePleadingFeeShares(10_000, { soleLawyerOnMatter: false })).toEqual({
      firmShare: 2_000,
      managingPartnerShare: 3_000,
      drafterShare: 5_000
    });
    expect(computePleadingFeeShares(10_000, { soleLawyerOnMatter: true })).toEqual({
      firmShare: 0,
      managingPartnerShare: 0,
      drafterShare: 10_000
    });
    expect(PLEADING_FEE_SHARE_PERCENTS.firm + PLEADING_FEE_SHARE_PERCENTS.managingPartner + PLEADING_FEE_SHARE_PERCENTS.drafter).toBe(100);
  });

  it("splits acceptance fees 20% firm / 40% managing partner / 40% associate", () => {
    expect(computeAcceptanceFeeShares(100_000)).toEqual({
      firmShare: 20_000,
      managingPartnerShare: 40_000,
      associateShare: 40_000
    });
  });

  it("uses the handling associate from the client profile", () => {
    expect(resolveAcceptanceFeeAssociateFromClient("Atty. April Liz Parreno")).toBe("Atty. April Liz Parreno");
    expect(
      resolveAcceptanceFeeAssociateFromClient(
        MANAGING_PARTNER.displayName,
        "Atty. Jeff Pasagui"
      )
    ).toBe("Atty. Jeff Pasagui");
    expect(resolveAcceptanceFeeAssociateFromClient(MANAGING_PARTNER.displayName)).toBe("Unassigned");
  });

  it("summarizes acceptance fee sharing by associate", () => {
    const summary = summarizeAcceptanceFeeSharing([
      {
        id: "1",
        date: "Jun 1, 2026",
        clientCode: "RET-A",
        clientName: "Client A",
        handlingAssociate: "Atty. Jeff Pasagui",
        label: "Acceptance fee",
        amount: 100_000,
        firmShare: 20_000,
        managingPartnerShare: 40_000,
        associateShare: 40_000
      }
    ]);
    expect(summary.firmTotal).toBe(20_000);
    expect(summary.managingPartnerTotal).toBe(40_000);
    expect(summary.byAssociate[0]?.shareTotal).toBe(40_000);
  });

  it("includes only professional and notarial ledger payments in office split", () => {
    expect(isOfficeSplitPayment("Acceptance Fee", "Intake", "")).toBe(false);
    expect(isOfficeSplitPayment("Pleading Fee", "Drafting pleading fee", "")).toBe(false);
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
    expect(buildPaymentLedgerFields("Pleading Fee")).toEqual({
      category: "Pleading Fee",
      description: "Pleading Fee"
    });
    expect(normalizePaymentIncomeType("payment for professional fee")).toBe("Professional Fee");
    expect(normalizePaymentIncomeType("Drafting pleading fee")).toBe("Pleading Fee");
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
      ...emptyAcceptanceReportFields(),
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

  it("documents acceptance fee share policy", () => {
    expect(
      ACCEPTANCE_FEE_SHARE_PERCENTS.firm +
        ACCEPTANCE_FEE_SHARE_PERCENTS.managingPartner +
        ACCEPTANCE_FEE_SHARE_PERCENTS.associate
    ).toBe(100);
  });
});
