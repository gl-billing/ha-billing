import { staffPayPeriodForDate, staffPayPeriodLabel, type StaffPayPeriod } from "@/lib/staff-salary";

/** Philippine Labor Code — monthly-paid staff. */
export const LABOR_CODE_REGULAR_HOLIDAYS_PER_YEAR = 12;
export const LABOR_CODE_SUNDAYS_PER_YEAR = 52;
export const LABOR_CODE_SATURDAYS_PER_YEAR = 52;
export const LABOR_CODE_STANDARD_HOURS_PER_DAY = 8;

export const LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY =
  365 - LABOR_CODE_REGULAR_HOLIDAYS_PER_YEAR - LABOR_CODE_SUNDAYS_PER_YEAR;

export const LABOR_CODE_ANNUAL_WORKING_DAYS_SAT_AND_SUN =
  365 -
  LABOR_CODE_REGULAR_HOLIDAYS_PER_YEAR -
  LABOR_CODE_SUNDAYS_PER_YEAR -
  LABOR_CODE_SATURDAYS_PER_YEAR;

/** Default divisor — Sunday rest days only (301 days). */
export const LABOR_CODE_ANNUAL_WORKING_DAYS = LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY;

export type StaffOvertimeRestDaySchedule = "sundayOnly" | "satAndSun";

export const STAFF_OVERTIME_REST_DAY_SCHEDULES: {
  id: StaffOvertimeRestDaySchedule;
  label: string;
  workingDays: number;
  divisorNote: string;
}[] = [
  {
    id: "sundayOnly",
    label: "Sunday only",
    workingDays: LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY,
    divisorNote: "365 − 12 regular holidays − 52 Sundays"
  },
  {
    id: "satAndSun",
    label: "Sat + Sun",
    workingDays: LABOR_CODE_ANNUAL_WORKING_DAYS_SAT_AND_SUN,
    divisorNote: "365 − 12 regular holidays − 52 Sundays − 52 Saturdays"
  }
];

export type StaffOvertimeDayType = "ordinary" | "restOrSpecial" | "regularHoliday";

export const STAFF_OVERTIME_DAY_TYPES: {
  id: StaffOvertimeDayType;
  label: string;
  multiplier: number;
  hint: string;
}[] = [
  {
    id: "ordinary",
    label: "Ordinary working day",
    multiplier: 1.25,
    hint: "Work beyond 8 hours · +25% on hourly rate"
  },
  {
    id: "restOrSpecial",
    label: "Rest day or special non-working day",
    multiplier: 1.3,
    hint: "Overtime premium · +30% on hourly rate"
  },
  {
    id: "regularHoliday",
    label: "Regular holiday",
    multiplier: 2.6,
    hint: "Overtime on regular holiday · 200% + 30% premium"
  }
];

export type StaffOvertimeComputation = {
  yearlySalary: number;
  monthlySalary: number;
  restDaySchedule: StaffOvertimeRestDaySchedule;
  restDayScheduleLabel: string;
  workingDays: number;
  workingDaysDivisorNote: string;
  dailyRate: number;
  hourlyRate: number;
  dayType: StaffOvertimeDayType;
  dayTypeLabel: string;
  dayMultiplier: number;
  nightShift: boolean;
  nightMultiplier: number;
  overtimeHourlyRate: number;
  hours: number;
  totalPay: number;
  payPeriod: StaffPayPeriod;
  payPeriodLabel: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function laborCodeAnnualWorkingDays(
  schedule: StaffOvertimeRestDaySchedule = "sundayOnly"
): number {
  return schedule === "satAndSun"
    ? LABOR_CODE_ANNUAL_WORKING_DAYS_SAT_AND_SUN
    : LABOR_CODE_ANNUAL_WORKING_DAYS_SUNDAY_ONLY;
}

export function staffOvertimeRestDayScheduleLabel(schedule: StaffOvertimeRestDaySchedule): string {
  return STAFF_OVERTIME_REST_DAY_SCHEDULES.find((entry) => entry.id === schedule)?.label ?? "Sunday only";
}

export function laborCodeRestDayDivisorNote(schedule: StaffOvertimeRestDaySchedule): string {
  return (
    STAFF_OVERTIME_REST_DAY_SCHEDULES.find((entry) => entry.id === schedule)?.divisorNote ??
    STAFF_OVERTIME_REST_DAY_SCHEDULES[0].divisorNote
  );
}

export function yearlySalaryFromMonthly(monthlySalary: number): number {
  return roundMoney(monthlySalary * 12);
}

export function laborCodeDailyRate(
  yearlySalary: number,
  workingDays: number = LABOR_CODE_ANNUAL_WORKING_DAYS
): number {
  if (yearlySalary <= 0 || workingDays <= 0) return 0;
  return roundMoney(yearlySalary / workingDays);
}

export function laborCodeHourlyRate(
  yearlySalary: number,
  workingDays: number = LABOR_CODE_ANNUAL_WORKING_DAYS
): number {
  const daily = laborCodeDailyRate(yearlySalary, workingDays);
  if (!daily) return 0;
  return roundMoney(daily / LABOR_CODE_STANDARD_HOURS_PER_DAY);
}

export function staffOvertimeDayMultiplier(dayType: StaffOvertimeDayType): number {
  return STAFF_OVERTIME_DAY_TYPES.find((entry) => entry.id === dayType)?.multiplier ?? 1.25;
}

export function staffOvertimeDayLabel(dayType: StaffOvertimeDayType): string {
  return STAFF_OVERTIME_DAY_TYPES.find((entry) => entry.id === dayType)?.label ?? "Ordinary working day";
}

export function computeStaffOvertimePay(input: {
  monthlySalary: number;
  hours: number;
  date: string;
  year: number;
  month: number;
  dayType?: StaffOvertimeDayType;
  nightShift?: boolean;
  restDaySchedule?: StaffOvertimeRestDaySchedule;
  /** Override divisor when testing or migrating legacy rows. */
  workingDays?: number;
}): StaffOvertimeComputation {
  const restDaySchedule = input.restDaySchedule ?? "sundayOnly";
  const workingDays = input.workingDays ?? laborCodeAnnualWorkingDays(restDaySchedule);
  const yearlySalary = yearlySalaryFromMonthly(input.monthlySalary);
  const dailyRate = laborCodeDailyRate(yearlySalary, workingDays);
  const hourlyRate = laborCodeHourlyRate(yearlySalary, workingDays);
  const dayType = input.dayType ?? "ordinary";
  const dayMultiplier = staffOvertimeDayMultiplier(dayType);
  const nightShift = Boolean(input.nightShift);
  const nightMultiplier = nightShift ? 1.1 : 1;
  const overtimeHourlyRate = roundMoney(hourlyRate * dayMultiplier * nightMultiplier);
  const hours = Math.max(0, Number(input.hours) || 0);
  const totalPay = roundMoney(overtimeHourlyRate * hours);
  const payPeriod = staffPayPeriodForDate(input.year, input.month, input.date);

  return {
    yearlySalary,
    monthlySalary: roundMoney(input.monthlySalary),
    restDaySchedule,
    restDayScheduleLabel: staffOvertimeRestDayScheduleLabel(restDaySchedule),
    workingDays,
    workingDaysDivisorNote: laborCodeRestDayDivisorNote(restDaySchedule),
    dailyRate,
    hourlyRate,
    dayType,
    dayTypeLabel: staffOvertimeDayLabel(dayType),
    dayMultiplier,
    nightShift,
    nightMultiplier,
    overtimeHourlyRate,
    hours,
    totalPay,
    payPeriod,
    payPeriodLabel: staffPayPeriodLabel(payPeriod)
  };
}

export function formatStaffOvertimeNote(result: StaffOvertimeComputation, date: string): string {
  const parts = [
    "Labor Code",
    `${result.restDayScheduleLabel} rest`,
    `${result.workingDays}-day divisor`,
    `${result.hours} hr${result.hours === 1 ? "" : "s"}`,
    result.dayTypeLabel
  ];
  if (result.nightShift) parts.push("night +10%");
  parts.push(
    `₱${result.yearlySalary.toLocaleString("en-US", { minimumFractionDigits: 2 })} ÷ ${result.workingDays} ÷ 8 × ${result.dayMultiplier}${result.nightShift ? " × 1.1" : ""} × ${result.hours}`
  );
  if (date) parts.unshift(date);
  return parts.join(" · ");
}

export function laborCodeOvertimeFormulaText(
  schedule: StaffOvertimeRestDaySchedule = "sundayOnly"
): string {
  const workingDays = laborCodeAnnualWorkingDays(schedule);
  return `(Yearly salary ÷ ${workingDays} ÷ 8) × OT rate × hours`;
}
