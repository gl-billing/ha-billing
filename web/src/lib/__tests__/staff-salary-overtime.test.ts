import { describe, expect, it } from "vitest";
import {
  computeStaffOvertimePay,
  formatStaffOvertimeNote,
  LABOR_CODE_ANNUAL_WORKING_DAYS_SAT_AND_SUN,
  LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY,
  laborCodeAnnualWorkingDays,
  laborCodeHourlyRate,
  yearlySalaryFromMonthly
} from "@/lib/staff-salary-overtime";

describe("staff salary overtime (Labor Code)", () => {
  it("uses 301 working days for Sunday-only rest (365 − 12 holidays − 52 Sundays)", () => {
    expect(LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY).toBe(301);
    expect(laborCodeAnnualWorkingDays("sundayOnly")).toBe(301);
  });

  it("uses 249 working days for Sat + Sun rest", () => {
    expect(LABOR_CODE_ANNUAL_WORKING_DAYS_SAT_AND_SUN).toBe(249);
    expect(laborCodeAnnualWorkingDays("satAndSun")).toBe(249);
  });

  it("derives yearly salary from monthly base", () => {
    expect(yearlySalaryFromMonthly(10000)).toBe(120000);
  });

  it("computes hourly rate for ₱120,000 yearly", () => {
    expect(laborCodeHourlyRate(120000)).toBe(49.83);
  });

  it("computes ordinary-day OT for 2 hours at ₱10,000 monthly", () => {
    const result = computeStaffOvertimePay({
      monthlySalary: 10000,
      hours: 2,
      date: "2026-06-05",
      year: 2026,
      month: 6,
      dayType: "ordinary"
    });

    expect(result.yearlySalary).toBe(120000);
    expect(result.dailyRate).toBe(398.67);
    expect(result.hourlyRate).toBe(49.83);
    expect(result.overtimeHourlyRate).toBe(62.29);
    expect(result.totalPay).toBe(124.58);
    expect(result.payPeriod).toBe("mid");
  });

  it("adds night differential and lands on end-of-month pay", () => {
    const result = computeStaffOvertimePay({
      monthlySalary: 10000,
      hours: 1,
      date: "2026-06-20",
      year: 2026,
      month: 6,
      dayType: "ordinary",
      nightShift: true
    });

    expect(result.overtimeHourlyRate).toBe(68.52);
    expect(result.totalPay).toBe(68.52);
    expect(result.payPeriod).toBe("end");
  });

  it("formats an audit-friendly adjustment note", () => {
    const result = computeStaffOvertimePay({
      monthlySalary: 10000,
      hours: 2,
      date: "2026-06-05",
      year: 2026,
      month: 6
    });

    expect(formatStaffOvertimeNote(result, "2026-06-05")).toContain("Labor Code");
    expect(formatStaffOvertimeNote(result, "2026-06-05")).toContain("301-day divisor");
    expect(formatStaffOvertimeNote(result, "2026-06-05")).toContain("2 hrs");
  });

  it("computes higher OT when Sat + Sun are rest days", () => {
    const result = computeStaffOvertimePay({
      monthlySalary: 10000,
      hours: 2,
      date: "2026-06-05",
      year: 2026,
      month: 6,
      restDaySchedule: "satAndSun"
    });

    expect(result.workingDays).toBe(249);
    expect(result.dailyRate).toBe(481.93);
    expect(result.hourlyRate).toBe(60.24);
    expect(result.overtimeHourlyRate).toBe(75.3);
    expect(result.totalPay).toBe(150.6);
  });
});
