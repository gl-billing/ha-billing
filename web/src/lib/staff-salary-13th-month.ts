import { formatPeso } from "@/lib/gl-config";
import {
  formatStaffPayrollAccount,
  staffSalaryPayslipReference,
  type StaffSalaryProfile
} from "@/lib/staff-salary";

export const STAFF_13TH_MONTH_STATUTE = "Presidential Decree No. 851";
export const STAFF_13TH_MONTH_FORMULA =
  "Total basic salary earned in the calendar year ÷ 12 (not less than one month's basic pay if employed the full year).";

export const STAFF_13TH_MONTH_SETTING_KEYS = {
  includedMonthsPrefix: "Staff Salary 13th Months"
} as const;

export type Staff13thMonthMonthLine = {
  month: number;
  monthLabel: string;
  baseSalary: number;
  included: boolean;
};

export type Staff13thMonthReport = {
  year: number;
  staffId: string;
  staffName: string;
  role: string;
  payrollBank: string;
  payrollAccountNumber: string;
  monthlyBaseSalary: number;
  months: Staff13thMonthMonthLine[];
  monthsWorked: number;
  totalBasicSalary: number;
  thirteenthMonthPay: number;
  statutoryNote: string;
  postedToPayroll: boolean;
  payrollAdjustmentId?: string;
  paid: boolean;
  paidAt?: string;
  transferred: boolean;
  transferredAt?: string;
  transferRef?: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function staff13thMonthToken(staffId: string, year: number): string {
  return `${staffId}:${year}`;
}

export function staff13thMonthIncludedMonthsKey(staffId: string, year: number): string {
  return `${STAFF_13TH_MONTH_SETTING_KEYS.includedMonthsPrefix} ${staff13thMonthToken(staffId, year)}`;
}

export function staff13thMonthPaidAtKey(staffId: string, year: number): string {
  return `Staff Salary 13th Paid At ${staff13thMonthToken(staffId, year)}`;
}

export function staff13thMonthTransferAtKey(staffId: string, year: number): string {
  return `Staff Salary 13th Transfer At ${staff13thMonthToken(staffId, year)}`;
}

export function staff13thMonthTransferRefKey(staffId: string, year: number): string {
  return `Staff Salary 13th Transfer Ref ${staff13thMonthToken(staffId, year)}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export function default13thMonthIncludedMonths(year: number, now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  if (year > currentYear) return [];
  return Array.from({ length: currentMonth }, (_, index) => index + 1);
}

export function parse13thMonthIncludedMonths(raw: string | undefined | null): number[] | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const months = trimmed
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  return months.length ? [...new Set(months)].sort((a, b) => a - b) : [];
}

export function serialize13thMonthIncludedMonths(months: number[]): string {
  return [...new Set(months.filter((month) => month >= 1 && month <= 12))]
    .sort((a, b) => a - b)
    .join(",");
}

export function read13thMonthIncludedMonths(
  settings: Map<string, string>,
  staffId: string,
  year: number,
  now: Date = new Date()
): number[] {
  const saved = parse13thMonthIncludedMonths(settings.get(staff13thMonthIncludedMonthsKey(staffId, year)));
  return saved ?? default13thMonthIncludedMonths(year, now);
}

export function computeStaff13thMonthPay(totalBasicSalary: number): number {
  if (totalBasicSalary <= 0) return 0;
  return roundMoney(totalBasicSalary / 12);
}

export function buildStaff13thMonthReport(input: {
  year: number;
  profile: StaffSalaryProfile;
  monthlyBaseSalary: number;
  includedMonths: number[];
  postedToPayroll?: boolean;
  payrollAdjustmentId?: string;
  paid?: boolean;
  paidAt?: string;
  transferred?: boolean;
  transferredAt?: string;
  transferRef?: string;
}): Staff13thMonthReport {
  const included = new Set(input.includedMonths);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      month,
      monthLabel: monthLabel(input.year, month),
      baseSalary: roundMoney(input.monthlyBaseSalary),
      included: included.has(month)
    };
  });

  const monthsWorked = months.filter((line) => line.included).length;
  const totalBasicSalary = roundMoney(input.monthlyBaseSalary * monthsWorked);
  const thirteenthMonthPay = computeStaff13thMonthPay(totalBasicSalary);

  return {
    year: input.year,
    staffId: input.profile.id,
    staffName: input.profile.displayName,
    role: input.profile.role,
    payrollBank: input.profile.payrollBank,
    payrollAccountNumber: input.profile.payrollAccountNumber,
    monthlyBaseSalary: roundMoney(input.monthlyBaseSalary),
    months,
    monthsWorked,
    totalBasicSalary,
    thirteenthMonthPay,
    statutoryNote: STAFF_13TH_MONTH_FORMULA,
    postedToPayroll: Boolean(input.postedToPayroll),
    payrollAdjustmentId: input.payrollAdjustmentId,
    paid: Boolean(input.paid),
    paidAt: input.paidAt,
    transferred: Boolean(input.transferred),
    transferredAt: input.transferredAt,
    transferRef: input.transferRef
  };
}

export function staff13thMonthReference(report: Pick<Staff13thMonthReport, "staffId" | "year">): string {
  return `13TH-${report.staffId.toUpperCase()}-${report.year}`;
}

export function formatStaff13thMonthTransferMemo(report: Staff13thMonthReport): string {
  return `${staff13thMonthReference(report)} · ${report.staffName} · 13th month pay · ${formatPeso(report.thirteenthMonthPay)} · ${formatStaffPayrollAccount(report)}`;
}

export function formatStaff13thMonthStatementText(report: Staff13thMonthReport): string {
  const lines = [
    `Hernandez & Associates — 13th month pay statement`,
    `${report.staffName} · ${report.role} · Calendar year ${report.year}`,
    `${STAFF_13TH_MONTH_STATUTE}`,
    "",
    `Monthly base salary: ${formatPeso(report.monthlyBaseSalary)}`,
    `Months counted: ${report.monthsWorked}`,
    "",
    "Monthly basic salary"
  ];

  report.months
    .filter((line) => line.included)
    .forEach((line) => {
      lines.push(`${line.monthLabel} ${report.year} · ${formatPeso(line.baseSalary)}`);
    });

  lines.push(
    "",
    `Total basic salary earned: ${formatPeso(report.totalBasicSalary)}`,
    `13th month pay (total basic ÷ 12): ${formatPeso(report.thirteenthMonthPay)}`,
    "",
    `Reference: ${staff13thMonthReference(report)}`,
    `Payroll account: ${formatStaffPayrollAccount(report)}`,
    report.paid ? `Status: PAID${report.paidAt ? ` · ${report.paidAt}` : ""}` : "Status: Pending",
    report.transferred
      ? `Transfer: recorded${report.transferRef ? ` · ${report.transferRef}` : ""}`
      : report.paid
        ? "Transfer: pending"
        : ""
  );

  return lines.filter(Boolean).join("\n");
}

export function staff13thMonthAdjustmentLabel(year: number): string {
  return `13th month pay ${year}`;
}

export function staff13thMonthAdjustmentDate(year: number): string {
  return `${year}-12-15`;
}

export function staff13thMonthAdjustmentNote(report: Staff13thMonthReport): string {
  return [
    STAFF_13TH_MONTH_STATUTE,
    `${report.monthsWorked} months`,
    `${formatPeso(report.totalBasicSalary)} basic ÷ 12`,
    staff13thMonthReference(report)
  ].join(" · ");
}

/** Payslip-style cross-reference when 13th month posts with December payroll. */
export function staff13thMonthPayrollCrossRef(report: Staff13thMonthReport): string {
  return `${staffSalaryPayslipReference({ staffId: report.staffId, year: report.year, month: 12 })} · ${staff13thMonthReference(report)}`;
}
