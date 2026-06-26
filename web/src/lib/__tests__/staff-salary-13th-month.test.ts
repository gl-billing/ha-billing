import { describe, expect, it } from "vitest";
import {
  buildStaff13thMonthReport,
  computeStaff13thMonthPay,
  default13thMonthIncludedMonths,
  formatStaff13thMonthStatementText,
  parse13thMonthIncludedMonths,
  serialize13thMonthIncludedMonths,
  staff13thMonthReference,
} from "@/lib/staff-salary-13th-month";
import { getStaffSalaryProfile } from "@/lib/staff-salary";
import { TEST_PAYROLL_ROSTER } from "@/lib/__tests__/fixtures/staff-payroll-roster";

describe("staff salary 13th month", () => {
  const profile = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)!;

  it("defaults included months through the current month for the current year", () => {
    expect(default13thMonthIncludedMonths(2026, new Date("2026-06-15"))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(default13thMonthIncludedMonths(2025)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("computes statutory 13th month pay as total basic salary ÷ 12", () => {
    expect(computeStaff13thMonthPay(120000)).toBe(10000);
    expect(computeStaff13thMonthPay(60000)).toBe(5000);
  });

  it("builds a full-year report at ₱10,000 monthly base", () => {
    const report = buildStaff13thMonthReport({
      year: 2026,
      profile,
      monthlyBaseSalary: 10000,
      includedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    });

    expect(report.totalBasicSalary).toBe(120000);
    expect(report.thirteenthMonthPay).toBe(10000);
    expect(report.monthsWorked).toBe(12);
    expect(staff13thMonthReference(report)).toBe("13TH-HAKOLA-2026");
  });

  it("pro-rates when only part of the year is included", () => {
    const report = buildStaff13thMonthReport({
      year: 2026,
      profile,
      monthlyBaseSalary: 10000,
      includedMonths: [6, 7, 8, 9, 10, 11, 12]
    });

    expect(report.totalBasicSalary).toBe(70000);
    expect(report.thirteenthMonthPay).toBe(5833.33);
    expect(report.monthsWorked).toBe(7);
  });

  it("serializes and parses included months", () => {
    expect(serialize13thMonthIncludedMonths([12, 3, 3, 1])).toBe("1,3,12");
    expect(parse13thMonthIncludedMonths("1,3,12")).toEqual([1, 3, 12]);
  });

  it("formats a copyable statement", () => {
    const report = buildStaff13thMonthReport({
      year: 2026,
      profile,
      monthlyBaseSalary: 10000,
      includedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      paid: true,
      paidAt: "2026-12-15"
    });

    const text = formatStaff13thMonthStatementText(report);
    expect(text).toContain("13th month pay (total basic ÷ 12)");
    expect(text).toContain("₱10,000.00");
    expect(text).toContain("Status: PAID");
  });
});
