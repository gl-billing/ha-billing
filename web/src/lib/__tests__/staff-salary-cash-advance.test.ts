import { describe, expect, it } from "vitest";
import {
  buildCashAdvanceAdjustmentsForMonth,
  buildCashAdvanceInstallments,
  cashAdvanceRemainingBalance,
  firstPayRunOnOrAfterDate,
  markCashAdvanceInstallmentsPaid,
  splitInstallmentAmounts,
  type StaffCashAdvance
} from "@/lib/staff-salary-cash-advance";

describe("staff cash advances", () => {
  it("starts deductions on the next pay run on or after the advance date", () => {
    expect(firstPayRunOnOrAfterDate("2026-06-10")).toEqual({ year: 2026, month: 6, period: "mid" });
    expect(firstPayRunOnOrAfterDate("2026-06-20")).toEqual({ year: 2026, month: 6, period: "end" });
  });

  it("builds four semi-monthly installments for a 2-month term", () => {
    const installments = buildCashAdvanceInstallments(4000, 2, "2026-06-10");
    expect(installments).toHaveLength(4);
    expect(installments.map((item) => `${item.year}-${item.month}:${item.period}`)).toEqual([
      "2026-6:mid",
      "2026-6:end",
      "2026-7:mid",
      "2026-7:end"
    ]);
    expect(installments.reduce((sum, item) => sum + item.amount, 0)).toBe(4000);
  });

  it("builds six semi-monthly installments for a 3-month term", () => {
    const installments = buildCashAdvanceInstallments(6000, 3, "2026-06-20");
    expect(installments).toHaveLength(6);
    expect(installments[0]).toMatchObject({ year: 2026, month: 6, period: "end", amount: 1000 });
    expect(installments.reduce((sum, item) => sum + item.amount, 0)).toBe(6000);
  });

  it("puts rounding remainder on the last installment", () => {
    expect(splitInstallmentAmounts(1000, 3)).toEqual([333.33, 333.33, 333.34]);
  });

  it("creates payroll deductions for the current month only", () => {
    const advance: StaffCashAdvance = {
      id: "ca-1",
      staffId: "jas",
      date: "2026-06-10",
      amount: 4000,
      termMonths: 2,
      note: "Emergency",
      status: "active",
      createdAt: "2026-06-10",
      installments: buildCashAdvanceInstallments(4000, 2, "2026-06-10")
    };

    const june = buildCashAdvanceAdjustmentsForMonth([advance], "jas", 2026, 6);
    expect(june).toHaveLength(2);
    expect(june[0].amount).toBe(-1000);
    expect(june[0].label).toBe("Cash advance · 1/4");

    const july = buildCashAdvanceAdjustmentsForMonth([advance], "jas", 2026, 7);
    expect(july).toHaveLength(2);
  });

  it("marks installments paid when a pay run is recorded", () => {
    const advance: StaffCashAdvance = {
      id: "ca-1",
      staffId: "jas",
      date: "2026-06-10",
      amount: 2000,
      termMonths: 2,
      note: "",
      status: "active",
      createdAt: "2026-06-10",
      installments: buildCashAdvanceInstallments(2000, 2, "2026-06-10")
    };

    const updated = markCashAdvanceInstallmentsPaid([advance], "jas", 2026, 6, "mid", "2026-06-15");
    expect(updated[0].installments[0].paidAt).toBe("2026-06-15");
    expect(cashAdvanceRemainingBalance(updated[0])).toBe(1500);
    expect(updated[0].status).toBe("active");

    const paid = markCashAdvanceInstallmentsPaid(updated, "jas", 2026, 6, "end", "2026-06-30");
    const paid2 = markCashAdvanceInstallmentsPaid(paid, "jas", 2026, 7, "mid", "2026-07-15");
    const paid3 = markCashAdvanceInstallmentsPaid(paid2, "jas", 2026, 7, "end", "2026-07-31");
    expect(paid3[0].status).toBe("paid");
    expect(cashAdvanceRemainingBalance(paid3[0])).toBe(0);
  });
});
