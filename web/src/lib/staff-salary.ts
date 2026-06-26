import { monthCloseToken } from "@/lib/firm-allocation";
import { findStaffSalaryProfileInRoster, type StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";
import {
  fieldDispatchSalaryCreditForEntry,
  formatPeso,
  type FieldDispatchEntry
} from "@/lib/gl-config";

export const DEFAULT_STAFF_MONTHLY_ALLOWANCE = 500;
export const STAFF_PAYROLL_BANK = "BPI";

export const STAFF_SALARY_SETTING_KEYS = {
  adjustments: "Staff Salary Adjustments",
  paidMonths: "Staff Salary Paid Months"
} as const;

export type { StaffCashAdvance, StaffCashAdvanceInstallment } from "@/lib/staff-salary-cash-advance";

export type StaffPayPeriod = "mid" | "end";

export type StaffSalaryProfile = {
  id: string;
  displayName: string;
  shortName: string;
  role: string;
  includesFieldDispatch: boolean;
  monthlyAllowance: number;
  matchNames: string[];
  payrollBank: string;
  payrollAccountNumber: string;
  email?: string;
  associatedLawyerName?: string;
  associatedLawyerEmail?: string;
};

/** @deprecated Payroll staff come from Settings → Staff Payroll Roster. */
export const STAFF_SALARY_PROFILES: StaffSalaryProfile[] = [];

export type StaffSalaryAdjustmentKind = "manual" | "overtime" | "thirteenthMonth";

export type StaffSalaryOvertimeMeta = {
  hours: number;
  dayType: "ordinary" | "restOrSpecial" | "regularHoliday";
  restDays: "sundayOnly" | "satAndSun";
  nightShift: boolean;
};

export type StaffSalaryAdjustment = {
  id: string;
  staffId: string;
  date: string;
  label: string;
  amount: number;
  note: string;
  kind?: StaffSalaryAdjustmentKind;
  overtime?: StaffSalaryOvertimeMeta;
};

export type FieldDispatchSalaryLine = {
  dispatchId: string;
  date: string;
  location: string;
  clientCode: string;
  purpose: string;
  advanceGiven: number;
  returnedToOffice: number;
  serviceFee: number;
  salaryCredit: number;
  salaryDue: number;
  staffSalaryPaid: boolean;
  staffSalaryPaidDate: string;
  status: string;
  payPeriod: StaffPayPeriod;
};

export type StaffPayRun = {
  period: StaffPayPeriod;
  label: string;
  nominalDayLabel: string;
  payDate: string;
  payDateLabel: string;
  shiftedFromWeekend: boolean;
  amount: number;
  breakdown: string;
  paid: boolean;
  paidAt?: string;
  transferred: boolean;
  transferredAt?: string;
  transferRef?: string;
};

export type StaffSalaryReport = {
  year: number;
  month: number;
  monthLabel: string;
  staffId: string;
  staffName: string;
  role: string;
  staffEmail?: string;
  associatedLawyerName?: string;
  associatedLawyerEmail?: string;
  payrollBank: string;
  payrollAccountNumber: string;
  includesFieldDispatch: boolean;
  baseSalary: number;
  monthlyAllowance: number;
  fieldDispatch: FieldDispatchSalaryLine[];
  totalFieldDispatchSalary: number;
  totalFieldDispatchPaidEarly: number;
  totalFieldDispatchDue: number;
  adjustments: StaffSalaryAdjustment[];
  totalAdjustments: number;
  cashAdvances: import("@/lib/staff-salary-cash-advance").StaffCashAdvance[];
  grossTotal: number;
  payRuns: StaffPayRun[];
  midMonthPaid: boolean;
  endMonthPaid: boolean;
  monthPaid: boolean;
};

export function staffSalaryBaseKey(staffId: string): string {
  return `Staff Salary Base ${staffId}`;
}

export function staffSalaryPaidAtKey(
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): string {
  return `Staff Salary Paid At ${staffSalaryPaidToken(staffId, year, month, period)}`;
}

export function staffSalaryTransferAtKey(
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): string {
  return `Staff Salary Transfer At ${staffSalaryPaidToken(staffId, year, month, period)}`;
}

export function staffSalaryTransferRefKey(
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): string {
  return `Staff Salary Transfer Ref ${staffSalaryPaidToken(staffId, year, month, period)}`;
}

export function staffSalaryPaidToken(
  staffId: string,
  year: number,
  month: number,
  period?: StaffPayPeriod
): string {
  const base = `${staffId}:${monthCloseToken(year, month)}`;
  return period ? `${base}:${period}` : base;
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function toYmdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** If the date falls on Sat/Sun, move to the prior business day (Friday). */
export function priorBusinessDayIfWeekend(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = result.getDay();
  if (weekday === 6) result.setDate(result.getDate() - 1);
  if (weekday === 0) result.setDate(result.getDate() - 2);
  return result;
}

export function resolveStaffPayDate(
  year: number,
  month: number,
  nominalDay: number
): {
  nominalDay: number;
  payDate: string;
  payDateLabel: string;
  shiftedFromWeekend: boolean;
} {
  const nominal = new Date(year, month - 1, nominalDay);
  const effective = priorBusinessDayIfWeekend(nominal);
  const payDate = toYmdLocal(effective);
  const shiftedFromWeekend = payDate !== toYmdLocal(nominal);

  return {
    nominalDay,
    payDate,
    payDateLabel: effective.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }),
    shiftedFromWeekend
  };
}

export function splitBaseSalaryForSemiMonthly(baseSalary: number): { mid: number; end: number } {
  const mid = Math.round((baseSalary / 2) * 100) / 100;
  const end = Math.round((baseSalary - mid) * 100) / 100;
  return { mid, end };
}

export function parseStaffSalaryDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** Days 1–15 → mid-month pay (15th); day 16 through last day → end-of-month pay. */
export function staffPayPeriodForDate(year: number, month: number, dateStr: string): StaffPayPeriod {
  const parsed = parseStaffSalaryDate(dateStr);
  if (!parsed || parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month) {
    return "end";
  }
  return parsed.getDate() <= 15 ? "mid" : "end";
}

export function staffPayPeriodLabel(period: StaffPayPeriod): string {
  return period === "mid" ? "Mid-month pay (15th)" : "End-of-month pay";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumFieldDispatchDueForPeriod(
  lines: FieldDispatchSalaryLine[],
  period: StaffPayPeriod
): number {
  return roundMoney(
    lines.reduce((sum, line) => sum + (line.payPeriod === period ? line.salaryDue : 0), 0)
  );
}

export function sumAdjustmentsForPeriod(
  adjustments: StaffSalaryAdjustment[],
  year: number,
  month: number,
  period: StaffPayPeriod
): number {
  return roundMoney(
    adjustments.reduce((sum, entry) => {
      if (staffPayPeriodForDate(year, month, entry.date) !== period) return sum;
      return sum + entry.amount;
    }, 0)
  );
}

export type StaffSalaryComputeRow = {
  label: string;
  detail?: string;
  amount: number | null;
  tone?: "default" | "deduct" | "subtotal" | "total" | "muted";
};

export type StaffSalaryComputeSection = {
  title: string;
  subtitle?: string;
  rows: StaffSalaryComputeRow[];
};

export function buildStaffSalaryComputation(report: StaffSalaryReport): StaffSalaryComputeSection[] {
  const { mid: midBase, end: endBase } = splitBaseSalaryForSemiMonthly(report.baseSalary);
  const midRun = report.payRuns.find((run) => run.period === "mid");
  const endRun = report.payRuns.find((run) => run.period === "end");

  const monthlyRows: StaffSalaryComputeRow[] = [
    {
      label: "Monthly base salary",
      detail: "Full month contract rate",
      amount: report.baseSalary
    },
    {
      label: "Monthly allowance",
      detail: "Paid with end-of-month run",
      amount: report.monthlyAllowance
    }
  ];

  const midDispatchDue = sumFieldDispatchDueForPeriod(report.fieldDispatch, "mid");
  const endDispatchDue = sumFieldDispatchDueForPeriod(report.fieldDispatch, "end");
  const midAdjustments = sumAdjustmentsForPeriod(report.adjustments, report.year, report.month, "mid");
  const endAdjustments = sumAdjustmentsForPeriod(report.adjustments, report.year, report.month, "end");

  if (report.includesFieldDispatch) {
    monthlyRows.push({
      label: "Field dispatch · service credits",
      detail: "Service fee minus change returned",
      amount: report.totalFieldDispatchSalary
    });
    if (report.totalFieldDispatchPaidEarly > 0) {
      monthlyRows.push({
        label: "Less · paid early (Field dispatch)",
        detail: "Marked paid early on dispatch register",
        amount: -report.totalFieldDispatchPaidEarly,
        tone: "deduct"
      });
      monthlyRows.push({
        label: "Field dispatch · due on payroll",
        detail: "Net after early payments · allocated to nearest payday",
        amount: report.totalFieldDispatchDue,
        tone: "subtotal"
      });
    }
    if (midDispatchDue > 0) {
      monthlyRows.push({
        label: "Field dispatch · mid-month pay",
        detail: "Trips on the 1st through 15th",
        amount: midDispatchDue,
        tone: "muted"
      });
    }
    if (endDispatchDue > 0) {
      monthlyRows.push({
        label: "Field dispatch · end-of-month pay",
        detail: "Trips on the 16th through last day",
        amount: endDispatchDue,
        tone: "muted"
      });
    }
  }

  if (report.adjustments.length) {
    report.adjustments.forEach((entry) => {
      const period = staffPayPeriodForDate(report.year, report.month, entry.date);
      monthlyRows.push({
        label: entry.label,
        detail: [entry.date, staffPayPeriodLabel(period), entry.note].filter(Boolean).join(" · "),
        amount: entry.amount,
        tone: entry.amount < 0 ? "deduct" : "default"
      });
    });
  } else if (report.totalAdjustments !== 0) {
    monthlyRows.push({
      label: "Adjustments",
      amount: report.totalAdjustments,
      tone: report.totalAdjustments < 0 ? "deduct" : "default"
    });
  }

  monthlyRows.push({
    label: "Total monthly compensation",
    detail: "Sum of all earnings this month",
    amount: report.grossTotal,
    tone: "total"
  });

  const midRows: StaffSalaryComputeRow[] = [
    {
      label: "One-half base salary",
      detail: midRun?.payDateLabel ? `Pay date · ${midRun.payDateLabel}` : "Nominal 15th",
      amount: midBase
    }
  ];

  if (report.includesFieldDispatch && midDispatchDue > 0) {
    midRows.push({
      label: "Field dispatch · net due",
      detail: "Trips on the 1st through 15th",
      amount: midDispatchDue
    });
  }

  report.adjustments
    .filter((entry) => staffPayPeriodForDate(report.year, report.month, entry.date) === "mid")
    .forEach((entry) => {
      midRows.push({
        label: entry.label,
        detail: [entry.date, entry.note].filter(Boolean).join(" · ") || "Adjustment",
        amount: entry.amount,
        tone: entry.amount < 0 ? "deduct" : "default"
      });
    });

  midRows.push({
    label: "Mid-month amount due",
    detail: midRun?.payDateLabel ? `Pay date · ${midRun.payDateLabel}` : "Nominal 15th",
    amount: midRun?.amount ?? midBase,
    tone: "total"
  });

  const endRows: StaffSalaryComputeRow[] = [
    {
      label: "One-half base salary",
      amount: endBase
    },
    {
      label: "Monthly allowance",
      amount: report.monthlyAllowance
    }
  ];

  if (report.includesFieldDispatch && endDispatchDue > 0) {
    endRows.push({
      label: "Field dispatch · net due",
      detail: "Trips on the 16th through last day",
      amount: endDispatchDue
    });
  }

  report.adjustments
    .filter((entry) => staffPayPeriodForDate(report.year, report.month, entry.date) === "end")
    .forEach((entry) => {
      endRows.push({
        label: entry.label,
        detail: [entry.date, entry.note].filter(Boolean).join(" · ") || "Adjustment",
        amount: entry.amount,
        tone: entry.amount < 0 ? "deduct" : "default"
      });
    });

  endRows.push({
    label: "End-of-month amount due",
    detail: endRun?.payDateLabel ? `Pay date · ${endRun.payDateLabel}` : "Nominal last day",
    amount: endRun?.amount ?? 0,
    tone: "total"
  });

  return [
    {
      title: "Monthly computation",
      subtitle: `${report.monthLabel} · ${report.staffName}`,
      rows: monthlyRows
    },
    {
      title: "Mid-month payment",
      subtitle: midRun
        ? `${midRun.payDateLabel}${midRun.shiftedFromWeekend ? " · prior business day" : ""}`
        : "Nominal 15th",
      rows: midRows
    },
    {
      title: "End-of-month payment",
      subtitle: endRun
        ? `${endRun.payDateLabel}${endRun.shiftedFromWeekend ? " · prior business day" : ""}`
        : "Nominal last day",
      rows: endRows
    }
  ];
}

export function isStaffPayPeriodPaid(
  paidMonths: Set<string>,
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): boolean {
  if (paidMonths.has(staffSalaryPaidToken(staffId, year, month, period))) return true;
  return paidMonths.has(staffSalaryPaidToken(staffId, year, month));
}

export function buildStaffPayRuns(input: {
  year: number;
  month: number;
  profile: StaffSalaryProfile;
  baseSalary: number;
  fieldDispatch: FieldDispatchSalaryLine[];
  adjustments: StaffSalaryAdjustment[];
  paidMid: boolean;
  paidEnd: boolean;
  paidMidAt?: string;
  paidEndAt?: string;
  midTransferred?: boolean;
  endTransferred?: boolean;
  midTransferredAt?: string;
  endTransferredAt?: string;
  midTransferRef?: string;
  endTransferRef?: string;
}): StaffPayRun[] {
  const { mid: midBase, end: endBase } = splitBaseSalaryForSemiMonthly(input.baseSalary);
  const midDate = resolveStaffPayDate(input.year, input.month, 15);
  const endDate = resolveStaffPayDate(input.year, input.month, lastDayOfMonth(input.year, input.month));

  const midDispatchDue = sumFieldDispatchDueForPeriod(input.fieldDispatch, "mid");
  const endDispatchDue = sumFieldDispatchDueForPeriod(input.fieldDispatch, "end");
  const midAdjustments = sumAdjustmentsForPeriod(input.adjustments, input.year, input.month, "mid");
  const endAdjustments = sumAdjustmentsForPeriod(input.adjustments, input.year, input.month, "end");

  const midAmount = roundMoney(midBase + midDispatchDue + midAdjustments);
  const endAmount = roundMoney(endBase + input.profile.monthlyAllowance + endDispatchDue + endAdjustments);

  const midBreakdownParts = [`½ base ${midBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}`];
  if (input.profile.includesFieldDispatch && midDispatchDue > 0) {
    midBreakdownParts.push(
      `field dispatch ${midDispatchDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  }
  if (midAdjustments !== 0) {
    midBreakdownParts.push(
      `adjustments ${midAdjustments.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  }

  const endBreakdownParts = [`½ base ${endBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}`];
  endBreakdownParts.push(
    `allowance ${input.profile.monthlyAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
  if (input.profile.includesFieldDispatch && endDispatchDue > 0) {
    endBreakdownParts.push(
      `field dispatch ${endDispatchDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  }
  if (endAdjustments !== 0) {
    endBreakdownParts.push(
      `adjustments ${endAdjustments.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  }

  return [
    {
      period: "mid",
      label: "Mid-month pay",
      nominalDayLabel: "15th",
      payDate: midDate.payDate,
      payDateLabel: midDate.payDateLabel,
      shiftedFromWeekend: midDate.shiftedFromWeekend,
      amount: midAmount,
      breakdown: midBreakdownParts.join(" + "),
      paid: input.paidMid,
      paidAt: input.paidMidAt,
      transferred: Boolean(input.midTransferred),
      transferredAt: input.midTransferredAt,
      transferRef: input.midTransferRef
    },
    {
      period: "end",
      label: "End-of-month pay",
      nominalDayLabel: "last day",
      payDate: endDate.payDate,
      payDateLabel: endDate.payDateLabel,
      shiftedFromWeekend: endDate.shiftedFromWeekend,
      amount: endAmount,
      breakdown: endBreakdownParts.join(" + "),
      paid: input.paidEnd,
      paidAt: input.paidEndAt,
      transferred: Boolean(input.endTransferred),
      transferredAt: input.endTransferredAt,
      transferRef: input.endTransferRef
    }
  ];
}

export function getStaffSalaryProfile(
  staffId: string,
  roster?: StaffPayrollRosterEntry[]
): StaffSalaryProfile | undefined {
  if (roster?.length) {
    return findStaffSalaryProfileInRoster(roster, staffId);
  }
  return STAFF_SALARY_PROFILES.find((profile) => profile.id === staffId);
}

export function formatStaffPayrollAccount(input: {
  payrollBank: string;
  payrollAccountNumber: string;
}): string {
  const account = input.payrollAccountNumber.trim();
  return account ? `${input.payrollBank} · ${account}` : `${input.payrollBank} · (set account in payroll profile)`;
}

export function staffSalaryPayslipReference(report: Pick<StaffSalaryReport, "staffId" | "year" | "month">): string {
  return `PAY-${report.staffId.toUpperCase()}-${report.year}${String(report.month).padStart(2, "0")}`;
}

export function formatStaffPayrollTransferMemo(
  report: StaffSalaryReport,
  run: StaffPayRun
): string {
  return `${staffSalaryPayslipReference(report)} · ${report.staffName} · ${run.label} · ${formatPeso(run.amount)} · ${formatStaffPayrollAccount(report)}`;
}

export function staffNameMatches(profile: StaffSalaryProfile, value: string): boolean {
  const haystack = value.trim().toLowerCase();
  if (!haystack) return false;
  return profile.matchNames.some((name) => haystack.includes(name) || name.includes(haystack));
}

export function buildFieldDispatchSalaryLine(
  entry: FieldDispatchEntry,
  year: number,
  month: number
): FieldDispatchSalaryLine | null {
  const salaryCredit = fieldDispatchSalaryCreditForEntry(entry);
  if (salaryCredit <= 0) return null;

  return {
    dispatchId: entry.dispatchId,
    date: entry.date,
    location: entry.location,
    clientCode: entry.clientCode,
    purpose: entry.purpose,
    advanceGiven: entry.advanceGiven,
    returnedToOffice: entry.returnedToOffice,
    serviceFee: entry.serviceFee,
    salaryCredit,
    salaryDue: entry.staffSalaryPaid ? 0 : salaryCredit,
    staffSalaryPaid: entry.staffSalaryPaid,
    staffSalaryPaidDate: entry.staffSalaryPaidDate,
    status: entry.status,
    payPeriod: staffPayPeriodForDate(year, month, entry.date)
  };
}

export function filterFieldDispatchForStaffMonth(
  entries: FieldDispatchEntry[],
  profile: StaffSalaryProfile,
  year: number,
  month: number
): FieldDispatchSalaryLine[] {
  if (!profile.includesFieldDispatch) return [];

  return entries
    .filter((entry) => {
      const d = new Date(entry.date);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;
      return staffNameMatches(profile, entry.staff);
    })
    .map((entry) => buildFieldDispatchSalaryLine(entry, year, month))
    .filter((line): line is FieldDispatchSalaryLine => line !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function filterAdjustmentsForStaffMonth(
  adjustments: StaffSalaryAdjustment[],
  staffId: string,
  year: number,
  month: number
): StaffSalaryAdjustment[] {
  return adjustments.filter((entry) => {
    if (entry.staffId !== staffId) return false;
    const d = new Date(entry.date);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function readStaffSalaryAdjustments(settings: Map<string, string>): StaffSalaryAdjustment[] {
  const raw = String(settings.get(STAFF_SALARY_SETTING_KEYS.adjustments) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StaffSalaryAdjustment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizeStaffSalaryAdjustment(entry));
  } catch {
    return [];
  }
}

export function isSyntheticCashAdvanceAdjustmentId(id: string): boolean {
  return id.startsWith("cash-adv-");
}

export function inferAdjustmentKind(entry: StaffSalaryAdjustment): StaffSalaryAdjustmentKind {
  if (entry.kind) return entry.kind;
  if (entry.label.trim().toLowerCase() === "overtime") return "overtime";
  if (/^13th month pay \d{4}$/i.test(entry.label.trim())) return "thirteenthMonth";
  return "manual";
}

export function normalizeStaffSalaryAdjustment(entry: StaffSalaryAdjustment): StaffSalaryAdjustment {
  return { ...entry, kind: inferAdjustmentKind(entry) };
}

export function assertStaffSalaryAdjustmentEditable(
  entry: StaffSalaryAdjustment,
  paidMonths: Set<string>
): void {
  if (isSyntheticCashAdvanceAdjustmentId(entry.id)) {
    throw new Error("Cash advance repayments are managed on the Cash advances tab.");
  }

  const date = parseStaffSalaryDate(entry.date);
  if (!date) throw new Error("Invalid adjustment date.");

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const period = staffPayPeriodForDate(year, month, entry.date);
  if (isStaffPayPeriodPaid(paidMonths, entry.staffId, year, month, period)) {
    throw new Error(
      `Cannot change this line — ${staffPayPeriodLabel(period)} for ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })} is already marked paid. Reopen that pay run first.`
    );
  }
}

export function findStaff13thMonthAdjustment(
  adjustments: StaffSalaryAdjustment[],
  staffId: string,
  year: number
): StaffSalaryAdjustment | undefined {
  return adjustments.find(
    (entry) =>
      entry.staffId === staffId &&
      inferAdjustmentKind(entry) === "thirteenthMonth" &&
      entry.date.startsWith(`${year}-`)
  );
}

export function readStaffSalaryPaidMonths(settings: Map<string, string>): Set<string> {
  const raw = String(settings.get(STAFF_SALARY_SETTING_KEYS.paidMonths) ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function readStaffBaseSalary(settings: Map<string, string>, staffId: string): number {
  const raw = String(settings.get(staffSalaryBaseKey(staffId)) ?? "").trim();
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function buildStaffSalaryReport(input: {
  year: number;
  month: number;
  profile: StaffSalaryProfile;
  baseSalary: number;
  fieldDispatch: FieldDispatchSalaryLine[];
  adjustments: StaffSalaryAdjustment[];
  paidMid: boolean;
  paidEnd: boolean;
  paidMidAt?: string;
  paidEndAt?: string;
  midTransferred?: boolean;
  endTransferred?: boolean;
  midTransferredAt?: string;
  endTransferredAt?: string;
  midTransferRef?: string;
  endTransferRef?: string;
  cashAdvances?: import("@/lib/staff-salary-cash-advance").StaffCashAdvance[];
}): StaffSalaryReport {
  const fieldDispatch = input.fieldDispatch.map((line) => ({
    ...line,
    payPeriod: line.payPeriod ?? staffPayPeriodForDate(input.year, input.month, line.date)
  }));
  const totalFieldDispatchSalary =
    Math.round(fieldDispatch.reduce((sum, line) => sum + line.salaryCredit, 0) * 100) / 100;
  const totalFieldDispatchPaidEarly =
    Math.round(
      fieldDispatch.reduce((sum, line) => sum + (line.staffSalaryPaid ? line.salaryCredit : 0), 0) * 100
    ) / 100;
  const totalFieldDispatchDue =
    Math.round((totalFieldDispatchSalary - totalFieldDispatchPaidEarly) * 100) / 100;
  const totalAdjustments =
    Math.round(input.adjustments.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const grossTotal =
    Math.round(
      (input.baseSalary + input.profile.monthlyAllowance + totalFieldDispatchDue + totalAdjustments) * 100
    ) / 100;

  const payRuns = buildStaffPayRuns({
    year: input.year,
    month: input.month,
    profile: input.profile,
    baseSalary: input.baseSalary,
    fieldDispatch,
    adjustments: input.adjustments,
    paidMid: input.paidMid,
    paidEnd: input.paidEnd,
    paidMidAt: input.paidMidAt,
    paidEndAt: input.paidEndAt,
    midTransferred: input.midTransferred,
    endTransferred: input.endTransferred,
    midTransferredAt: input.midTransferredAt,
    endTransferredAt: input.endTransferredAt,
    midTransferRef: input.midTransferRef,
    endTransferRef: input.endTransferRef
  });

  return {
    year: input.year,
    month: input.month,
    monthLabel: new Date(input.year, input.month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    }),
    staffId: input.profile.id,
    staffName: input.profile.displayName,
    role: input.profile.role,
    staffEmail: input.profile.email,
    associatedLawyerName: input.profile.associatedLawyerName,
    associatedLawyerEmail: input.profile.associatedLawyerEmail,
    payrollBank: input.profile.payrollBank,
    payrollAccountNumber: input.profile.payrollAccountNumber,
    includesFieldDispatch: input.profile.includesFieldDispatch,
    baseSalary: input.baseSalary,
    monthlyAllowance: input.profile.monthlyAllowance,
    fieldDispatch,
    totalFieldDispatchSalary,
    totalFieldDispatchPaidEarly,
    totalFieldDispatchDue,
    adjustments: input.adjustments,
    totalAdjustments,
    cashAdvances: input.cashAdvances ?? [],
    grossTotal,
    payRuns,
    midMonthPaid: input.paidMid,
    endMonthPaid: input.paidEnd,
    monthPaid: input.paidMid && input.paidEnd
  };
}

export function formatStaffSalaryStatementText(report: StaffSalaryReport): string {
  const lines = [
    `Hernandez & Associates — Staff salary statement`,
    `${report.staffName} · ${report.role} · ${report.monthLabel}`,
    `Payroll account: ${formatStaffPayrollAccount(report)}`,
    "",
    `Base salary: ₱${report.baseSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `Monthly allowance: ₱${report.monthlyAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  ];

  if (report.includesFieldDispatch) {
    lines.push(
      `Field dispatch earned: ₱${report.totalFieldDispatchSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
    if (report.totalFieldDispatchPaidEarly > 0) {
      lines.push(
        `Paid early from dispatch tab: −₱${report.totalFieldDispatchPaidEarly.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      );
      lines.push(
        `Field dispatch due on payroll: ₱${report.totalFieldDispatchDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      );
    }
  }

  lines.push(
    `Adjustments: ₱${report.totalAdjustments.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    "",
    `Total due: ₱${report.grossTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    "",
    "Pay schedule (weekends → prior business day)"
  );

  report.payRuns.forEach((run) => {
    lines.push(
      `${run.label} · ${run.payDateLabel}${run.shiftedFromWeekend ? ` (nominal ${run.nominalDayLabel})` : ""} · ₱${run.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} · ${run.breakdown}${run.paid ? " · PAID" : ""}${run.transferred ? ` · TRANSFERRED${run.transferRef ? ` (${run.transferRef})` : ""}` : ""}`
    );
    if (run.paid && !run.transferred) {
      lines.push(`  Bank memo: ${formatStaffPayrollTransferMemo(report, run)}`);
    }
  });

  lines.push("");

  if (report.includesFieldDispatch && report.fieldDispatch.length) {
    lines.push("Field dispatch");
    report.fieldDispatch.forEach((trip) => {
      const paidNote = trip.staffSalaryPaid
        ? ` · paid to staff ${trip.staffSalaryPaidDate || ""}`.trim()
        : "";
      lines.push(
        `${trip.date} · ${staffPayPeriodLabel(trip.payPeriod)} · ${trip.location} · fee ₱${trip.serviceFee.toLocaleString("en-US", { minimumFractionDigits: 2 })} − returned ₱${trip.returnedToOffice.toLocaleString("en-US", { minimumFractionDigits: 2 })} = ₱${trip.salaryCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}${paidNote}`
      );
    });
    lines.push("");
  }

  if (report.adjustments.length) {
    lines.push("Adjustments");
    report.adjustments.forEach((entry) => {
      const period = staffPayPeriodForDate(report.year, report.month, entry.date);
      lines.push(
        `${entry.date} · ${staffPayPeriodLabel(period)} · ${entry.label} · ₱${entry.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}${entry.note ? ` · ${entry.note}` : ""}`
      );
    });
  }

  return lines.join("\n");
}
