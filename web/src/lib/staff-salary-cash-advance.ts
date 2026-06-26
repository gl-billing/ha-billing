import {
  lastDayOfMonth,
  parseStaffSalaryDate,
  staffPayPeriodForDate,
  type StaffPayPeriod,
  type StaffSalaryAdjustment
} from "@/lib/staff-salary";

export type StaffCashAdvanceTermMonths = 2 | 3;

export type StaffCashAdvanceStatus = "active" | "paid" | "cancelled";

export type StaffCashAdvanceInstallment = {
  index: number;
  year: number;
  month: number;
  period: StaffPayPeriod;
  amount: number;
  paidAt?: string;
};

export type StaffCashAdvance = {
  id: string;
  staffId: string;
  date: string;
  amount: number;
  termMonths: StaffCashAdvanceTermMonths;
  note: string;
  status: StaffCashAdvanceStatus;
  installments: StaffCashAdvanceInstallment[];
  createdAt: string;
};

export const STAFF_CASH_ADVANCE_SETTING_KEY = "Staff Salary Cash Advances";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

/** First semi-monthly pay run on or after the advance date. */
export function firstPayRunOnOrAfterDate(dateStr: string): { year: number; month: number; period: StaffPayPeriod } {
  const parsed = parseStaffSalaryDate(dateStr);
  if (!parsed) throw new Error("Enter a valid advance date.");

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const period = staffPayPeriodForDate(year, month, dateStr);
  return { year, month, period };
}

export function nextPayRun(current: {
  year: number;
  month: number;
  period: StaffPayPeriod;
}): { year: number; month: number; period: StaffPayPeriod } {
  if (current.period === "mid") {
    return { year: current.year, month: current.month, period: "end" };
  }

  let month = current.month + 1;
  let year = current.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return { year, month, period: "mid" };
}

export function splitInstallmentAmounts(total: number, count: number): number[] {
  if (count <= 0) return [];
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const amounts = Array.from({ length: count }, () => baseCents);
  amounts[count - 1] += remainder;
  return amounts.map((cents) => cents / 100);
}

export function buildCashAdvanceInstallments(
  amount: number,
  termMonths: StaffCashAdvanceTermMonths,
  advanceDate: string
): StaffCashAdvanceInstallment[] {
  const installmentCount = termMonths * 2;
  const amounts = splitInstallmentAmounts(amount, installmentCount);
  let run = firstPayRunOnOrAfterDate(advanceDate);

  return amounts.map((installmentAmount, index) => {
    const installment = {
      index,
      year: run.year,
      month: run.month,
      period: run.period,
      amount: roundMoney(installmentAmount)
    };
    run = nextPayRun(run);
    return installment;
  });
}

export function installmentAdjustmentDate(year: number, month: number, period: StaffPayPeriod): string {
  if (period === "mid") return `${year}-${padMonth(month)}-15`;
  return `${year}-${padMonth(month)}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;
}

export function cashAdvanceRemainingBalance(advance: StaffCashAdvance): number {
  if (advance.status === "cancelled") return 0;
  return roundMoney(
    advance.installments.reduce((sum, installment) => sum + (installment.paidAt ? 0 : installment.amount), 0)
  );
}

export function refreshCashAdvanceStatus(advance: StaffCashAdvance): StaffCashAdvance {
  if (advance.status === "cancelled") return advance;
  const remaining = cashAdvanceRemainingBalance(advance);
  return {
    ...advance,
    status: remaining <= 0 ? "paid" : "active"
  };
}

export function buildCashAdvanceAdjustmentsForMonth(
  advances: StaffCashAdvance[],
  staffId: string,
  year: number,
  month: number
): StaffSalaryAdjustment[] {
  return advances
    .filter((advance) => advance.staffId === staffId && advance.status !== "cancelled")
    .flatMap((advance) =>
      advance.installments
        .filter((installment) => installment.year === year && installment.month === month)
        .map((installment) => ({
          id: `cash-adv-${advance.id}-${installment.index}`,
          staffId,
          date: installmentAdjustmentDate(year, month, installment.period),
          label: `Cash advance · ${installment.index + 1}/${advance.installments.length}`,
          amount: -installment.amount,
          note: [advance.date, advance.note].filter(Boolean).join(" · ") || "Staff cash advance"
        }))
    );
}

export function markCashAdvanceInstallmentsPaid(
  advances: StaffCashAdvance[],
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod,
  paidAt: string
): StaffCashAdvance[] {
  return advances.map((advance) => {
    if (advance.staffId !== staffId || advance.status === "cancelled") return advance;

    let changed = false;
    const installments = advance.installments.map((installment) => {
      if (
        installment.year === year &&
        installment.month === month &&
        installment.period === period &&
        !installment.paidAt
      ) {
        changed = true;
        return { ...installment, paidAt };
      }
      return installment;
    });

    if (!changed) return advance;
    return refreshCashAdvanceStatus({ ...advance, installments });
  });
}

export function reopenCashAdvanceInstallments(
  advances: StaffCashAdvance[],
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): StaffCashAdvance[] {
  return advances.map((advance) => {
    if (advance.staffId !== staffId) return advance;

    let changed = false;
    const installments = advance.installments.map((installment) => {
      if (
        installment.year === year &&
        installment.month === month &&
        installment.period === period &&
        installment.paidAt
      ) {
        changed = true;
        const { paidAt: _paidAt, ...rest } = installment;
        return rest;
      }
      return installment;
    });

    if (!changed) return advance;
    return refreshCashAdvanceStatus({ ...advance, status: "active", installments });
  });
}

export function readStaffCashAdvances(settings: Map<string, string>): StaffCashAdvance[] {
  const raw = String(settings.get(STAFF_CASH_ADVANCE_SETTING_KEY) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StaffCashAdvance[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((advance) => refreshCashAdvanceStatus(advance));
  } catch {
    return [];
  }
}

export function formatCashAdvanceScheduleLabel(advance: StaffCashAdvance): string {
  const count = advance.installments.length;
  return `${advance.termMonths} months · ${count} paychecks`;
}
