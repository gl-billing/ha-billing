import { describe, expect, it } from "vitest";
import {
  buildStaffPayRunPayslipHtml,
  buildStaffPayRunPayslipPreview,
  formatStaffPayRunPayslipText,
  getStaffPayRunPayslipSection,
  resolveStaffEmail
} from "@/lib/staff-salary-payslip-email";
import { buildStaffSalaryReport, getStaffSalaryProfile } from "@/lib/staff-salary";
import { findStaffSalaryProfileInRoster } from "@/lib/staff-payroll-roster";
import { TEST_PAYROLL_ROSTER } from "@/lib/__tests__/fixtures/staff-payroll-roster";

describe("staff salary payslip email", () => {
  const hakola = getStaffSalaryProfile("hakola", TEST_PAYROLL_ROSTER);
  if (!hakola) throw new Error("hakola profile missing");

  const report = buildStaffSalaryReport({
    year: 2026,
    month: 6,
    profile: hakola,
    baseSalary: 20_000,
    fieldDispatch: [
      {
        dispatchId: "fd-1",
        date: "2026-06-05",
        location: "RTC",
        clientCode: "ABC",
        purpose: "Hearing",
        advanceGiven: 1500,
        returnedToOffice: 200,
        serviceFee: 1500,
        salaryCredit: 1300,
        salaryDue: 1300,
        staffSalaryPaid: false,
        staffSalaryPaidDate: "",
        status: "Reconciled",
        payPeriod: "mid"
      },
      {
        dispatchId: "fd-2",
        date: "2026-06-20",
        location: "LTO",
        clientCode: "XYZ",
        purpose: "Filing",
        advanceGiven: 800,
        returnedToOffice: 0,
        serviceFee: 800,
        salaryCredit: 800,
        salaryDue: 800,
        staffSalaryPaid: false,
        staffSalaryPaidDate: "",
        status: "Reconciled",
        payPeriod: "end"
      }
    ],
    adjustments: [
      {
        id: "adj-1",
        staffId: "hakola",
        date: "2026-06-10",
        label: "Overtime",
        amount: 500,
        note: "Hearing prep"
      },
      {
        id: "adj-2",
        staffId: "hakola",
        date: "2026-06-25",
        label: "Reimbursement",
        amount: 200,
        note: "Supplies"
      }
    ],
    paidMid: true,
    paidEnd: false
  });

  it("builds a mid-month section without monthly gross totals", () => {
    const section = getStaffPayRunPayslipSection(report, "mid");
    expect(section?.title).toBe("Mid-month payment");
    expect(section?.rows.some((row) => row.label === "Total monthly compensation")).toBe(false);
    expect(section?.rows.some((row) => row.label === "Monthly allowance")).toBe(false);
    expect(section?.rows.some((row) => row.label === "Mid-month amount due")).toBe(true);
  });

  it("formats plain text for one pay run only", () => {
    const text = formatStaffPayRunPayslipText(report, "mid");
    expect(text).toContain("mid-month payment");
    expect(text).toContain("Field dispatch · net due");
    expect(text).toContain("Overtime");
    expect(text).not.toContain("Total monthly compensation");
    expect(text).not.toContain("End-of-month amount due");
    expect(text).not.toContain("Monthly allowance");
    expect(text).toContain("This covers this pay run only");
  });

  it("formats end-of-month text without mid-month lines", () => {
    const text = formatStaffPayRunPayslipText(report, "end");
    expect(text).toContain("End-of-month amount due");
    expect(text).toContain("Monthly allowance");
    expect(text).not.toContain("Mid-month amount due");
    expect(text).not.toContain("Total monthly compensation");
  });

  it("builds HTML without the other pay run", () => {
    const html = buildStaffPayRunPayslipHtml(report, "mid");
    expect(html).toContain("Mid-month amount due");
    expect(html).not.toContain("End-of-month amount due");
    expect(html).not.toContain("Total monthly compensation");
    expect(html).toContain("/brand/logo.png");
    expect(html).toContain("Amount due this pay run");
    expect(html).toContain("this pay run only");
    expect(html).toContain("Payment released");
    expect(html).not.toContain("#166534");
    expect(html).toContain("Respectfully,");
  });

  it("resolves staff email from employee directory", () => {
    const directory = [
      { name: "James Bryan Hakola", email: "hakola@example.com", role: "Staff", active: true },
      { name: "Ellyza Andrea Aguanta", email: "andrea@example.com", role: "Staff", active: true }
    ];
    expect(resolveStaffEmail(hakola, directory)?.email).toBe("hakola@example.com");
    const andrea = getStaffSalaryProfile("andrea", TEST_PAYROLL_ROSTER);
    expect(andrea && resolveStaffEmail(andrea, directory)?.email).toBe("andrea@example.com");
  });

  it("builds preview payload with subject, html, and recipient", () => {
    const directory = [{ name: "James Bryan Hakola", email: "hakola@example.com", role: "Staff", active: true }];
    const preview = buildStaffPayRunPayslipPreview(report, "mid", directory);
    expect(preview.subject).toContain("June 2026");
    expect(preview.recipientEmail).toBe("hakola@example.com");
    expect(preview.html).toContain("/brand/logo.png");
    expect(preview.html).not.toContain("#166534");
    expect(preview.html).not.toContain("#f0fdf4");
    expect(preview.recipientError).toBeNull();
  });
});
