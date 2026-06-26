import { describe, expect, it } from "vitest";
import { fieldDispatchSalaryCredit, fieldDispatchSalaryCreditForEntry } from "@/lib/gl-config";
import {
  buildStaffPayRuns,
  buildStaffSalaryComputation,
  buildStaffSalaryReport,
  DEFAULT_STAFF_MONTHLY_ALLOWANCE,
  filterFieldDispatchForStaffMonth,
  getStaffSalaryProfile,
  priorBusinessDayIfWeekend,
  resolveStaffPayDate,
  splitBaseSalaryForSemiMonthly,
  staffPayPeriodForDate,
  STAFF_SALARY_PROFILES,
  toYmdLocal
} from "@/lib/staff-salary";
import type { FieldDispatchEntry } from "@/lib/gl-config";
import { findStaffSalaryProfileInRoster } from "@/lib/staff-payroll-roster";
import { TEST_PAYROLL_ROSTER } from "@/lib/__tests__/fixtures/staff-payroll-roster";

describe("staff salary", () => {
  it("credits service fee minus returned change", () => {
    expect(fieldDispatchSalaryCredit(1500, 200)).toBe(1300);
    expect(fieldDispatchSalaryCredit(1500, 0)).toBe(1500);
    expect(fieldDispatchSalaryCredit(1500, 1500)).toBe(0);
    expect(fieldDispatchSalaryCredit(1500, 200, false)).toBe(0);
  });

  it("uses full service fee on open trips until reconciled", () => {
    expect(
      fieldDispatchSalaryCreditForEntry({
        serviceFee: 1500,
        returnedToOffice: 0,
        status: "Active"
      })
    ).toBe(1500);
    expect(
      fieldDispatchSalaryCreditForEntry({
        serviceFee: 1500,
        returnedToOffice: 300,
        status: "Reconciled"
      })
    ).toBe(1200);
  });

  it("loads payroll profiles from roster entries", () => {
    expect(STAFF_SALARY_PROFILES).toHaveLength(0);
    expect(getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)?.monthlyAllowance).toBe(
      DEFAULT_STAFF_MONTHLY_ALLOWANCE
    );
    expect(getStaffSalaryProfile("andrea", TEST_PAYROLL_ROSTER)?.monthlyAllowance).toBe(
      DEFAULT_STAFF_MONTHLY_ALLOWANCE
    );
    expect(getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)?.displayName).toBe("James Bryan Hakola");
    expect(getStaffSalaryProfile("andrea", TEST_PAYROLL_ROSTER)?.displayName).toBe("Ellyza Andrea Aguanta");
  });

  it("assigns items to the nearest semi-monthly payday by event date", () => {
    expect(staffPayPeriodForDate(2026, 6, "2026-06-05")).toBe("mid");
    expect(staffPayPeriodForDate(2026, 6, "2026-06-15")).toBe("mid");
    expect(staffPayPeriodForDate(2026, 6, "2026-06-16")).toBe("end");
    expect(staffPayPeriodForDate(2026, 6, "2026-06-30")).toBe("end");
  });

  it("moves weekend pay dates to the prior business day", () => {
    const sunday15 = resolveStaffPayDate(2025, 6, 15);
    expect(sunday15.shiftedFromWeekend).toBe(true);
    expect(sunday15.payDate).toBe("2025-06-13");

    const sundayEnd = resolveStaffPayDate(2025, 11, 30);
    expect(sundayEnd.shiftedFromWeekend).toBe(true);
    expect(sundayEnd.payDate).toBe("2025-11-28");

    const weekday = resolveStaffPayDate(2026, 6, 15);
    expect(weekday.shiftedFromWeekend).toBe(false);
    expect(weekday.payDate).toBe("2026-06-15");
  });

  it("priorBusinessDayIfWeekend handles Saturday and Sunday", () => {
    expect(toYmdLocal(priorBusinessDayIfWeekend(new Date(2026, 5, 14)))).toBe("2026-06-12");
    expect(toYmdLocal(priorBusinessDayIfWeekend(new Date(2026, 5, 15)))).toBe("2026-06-15");
  });

  it("splits base salary evenly across two pays", () => {
    expect(splitBaseSalaryForSemiMonthly(10001)).toEqual({ mid: 5000.5, end: 5000.5 });
  });

  it("builds semi-monthly pay runs with allowance on end pay only", () => {
    const profile = getStaffSalaryProfile("andrea", TEST_PAYROLL_ROSTER)!;
    const runs = buildStaffPayRuns({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [],
      adjustments: [],
      paidMid: false,
      paidEnd: false
    });

    expect(runs).toHaveLength(2);
    expect(runs[0]?.amount).toBe(5000);
    expect(runs[1]?.amount).toBe(5500);
    expect(runs[1]?.breakdown).toContain("allowance");
  });

  it("puts late-month field dispatch and adjustments on end-of-month pay", () => {
    const profile = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)!;
    const runs = buildStaffPayRuns({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [
        {
          dispatchId: "FD-0001",
          date: "2026-06-20",
          location: "Tagum",
          clientCode: "RET-A",
          purpose: "Filing",
          advanceGiven: 1500,
          returnedToOffice: 300,
          serviceFee: 1500,
          salaryCredit: 1200,
          salaryDue: 1200,
          staffSalaryPaid: false,
          staffSalaryPaidDate: "",
          status: "Reconciled",
          payPeriod: "end"
        }
      ],
      adjustments: [{ id: "adj-1", staffId: "hakola", date: "2026-06-25", label: "Bonus", amount: 200, note: "" }],
      paidMid: false,
      paidEnd: false
    });

    expect(runs[0]?.amount).toBe(5000);
    expect(runs[1]?.amount).toBe(6900);
  });

  it("puts early-month field dispatch and adjustments on mid-month pay", () => {
    const profile = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)!;
    const runs = buildStaffPayRuns({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [
        {
          dispatchId: "FD-0001",
          date: "2026-06-05",
          location: "Tagum",
          clientCode: "RET-A",
          purpose: "Filing",
          advanceGiven: 1500,
          returnedToOffice: 300,
          serviceFee: 1500,
          salaryCredit: 1200,
          salaryDue: 1200,
          staffSalaryPaid: false,
          staffSalaryPaidDate: "",
          status: "Reconciled",
          payPeriod: "mid"
        }
      ],
      adjustments: [{ id: "adj-1", staffId: "hakola", date: "2026-06-10", label: "Bonus", amount: 300, note: "" }],
      paidMid: false,
      paidEnd: false
    });

    expect(runs[0]?.amount).toBe(6500);
    expect(runs[1]?.amount).toBe(5500);
  });

  it("builds Jas field dispatch lines for the month", () => {
    const profile = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER);
    const entries: FieldDispatchEntry[] = [
      {
        dispatchId: "FD-0001",
        date: "2026-06-05",
        days: 1,
        location: "Tagum",
        staff: "James Bryan Hakola (Liaison Officer)",
        clientCode: "RET-A",
        purpose: "Court filing",
        advanceGiven: 1500,
        actualExpenses: 1200,
        returnedToOffice: 300,
        serviceFee: 1500,
        billableTotal: 2700,
        reimbursementStatus: "Open",
        billedDate: "",
        notes: "",
        recordedBy: "Admin",
        status: "Reconciled",
        staffSalaryPaid: false,
        staffSalaryPaidDate: "",
        rowNumber: 2
      }
    ];

    const lines = filterFieldDispatchForStaffMonth(entries, profile!, 2026, 6);
    expect(lines[0]?.salaryCredit).toBe(1200);
    expect(lines[0]?.payPeriod).toBe("mid");
  });

  it("totals base, allowance, dispatch, and adjustments", () => {
    const profile = findStaffSalaryProfileInRoster(TEST_PAYROLL_ROSTER, "hakola")!;
    const report = buildStaffSalaryReport({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [
        {
          dispatchId: "FD-0001",
          date: "Jun 5, 2026",
          location: "Tagum",
          clientCode: "RET-A",
          purpose: "Filing",
          advanceGiven: 1500,
          returnedToOffice: 300,
          serviceFee: 1500,
          salaryCredit: 1200,
          salaryDue: 1200,
          staffSalaryPaid: false,
          staffSalaryPaidDate: "",
          status: "Reconciled",
          payPeriod: "mid"
        }
      ],
      adjustments: [{ id: "adj-1", staffId: "hakola", date: "2026-06-15", label: "Bonus", amount: 500, note: "" }],
      paidMid: false,
      paidEnd: false
    });

    expect(report.grossTotal).toBe(12200);
    expect(report.payRuns[0]?.amount).toBe(6700);
    expect(report.payRuns[1]?.amount).toBe(5500);
    expect(report.monthPaid).toBe(false);
  });

  it("deducts field dispatch already paid to staff from payroll", () => {
    const profile = findStaffSalaryProfileInRoster(TEST_PAYROLL_ROSTER, "hakola")!;
    const report = buildStaffSalaryReport({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [
        {
          dispatchId: "FD-0001",
          date: "Jun 5, 2026",
          location: "Tagum",
          clientCode: "RET-A",
          purpose: "Filing",
          advanceGiven: 1500,
          returnedToOffice: 300,
          serviceFee: 1500,
          salaryCredit: 1200,
          salaryDue: 0,
          staffSalaryPaid: true,
          staffSalaryPaidDate: "2026-06-05",
          status: "Reconciled",
          payPeriod: "mid"
        }
      ],
      adjustments: [],
      paidMid: false,
      paidEnd: false
    });

    expect(report.totalFieldDispatchSalary).toBe(1200);
    expect(report.totalFieldDispatchPaidEarly).toBe(1200);
    expect(report.totalFieldDispatchDue).toBe(0);
    expect(report.grossTotal).toBe(10500);
    expect(report.payRuns[0]?.amount).toBe(5000);
    expect(report.payRuns[1]?.amount).toBe(5500);
  });

  it("builds a clear monthly and pay-run computation", () => {
    const profile = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER)!;
    const report = buildStaffSalaryReport({
      year: 2026,
      month: 6,
      profile,
      baseSalary: 10000,
      fieldDispatch: [
        {
          dispatchId: "FD-0001",
          date: "2026-06-05",
          location: "Tagum",
          clientCode: "RET-A",
          purpose: "Filing",
          advanceGiven: 1500,
          returnedToOffice: 300,
          serviceFee: 1500,
          salaryCredit: 1200,
          salaryDue: 0,
          staffSalaryPaid: true,
          staffSalaryPaidDate: "2026-06-05",
          status: "Reconciled",
          payPeriod: "mid"
        }
      ],
      adjustments: [{ id: "adj-1", staffId: "hakola", date: "2026-06-15", label: "Overtime", amount: 500, note: "" }],
      paidMid: false,
      paidEnd: false
    });

    const sections = buildStaffSalaryComputation(report);
    const monthly = sections.find((section) => section.title === "Monthly computation");
    const mid = sections.find((section) => section.title === "Mid-month payment");
    const end = sections.find((section) => section.title === "End-of-month payment");

    expect(monthly?.rows.some((row) => row.label === "Less · paid early (Field dispatch)")).toBe(true);
    expect(monthly?.rows.at(-1)?.amount).toBe(report.grossTotal);
    expect(mid?.rows.at(-1)?.amount).toBe(5500);
    expect(end?.rows.at(-1)?.amount).toBe(5500);
  });
});
