import {
  buildStaffSalaryReport,
  filterAdjustmentsForStaffMonth,
  filterFieldDispatchForStaffMonth,
  findStaff13thMonthAdjustment,
  assertStaffSalaryAdjustmentEditable,
  inferAdjustmentKind,
  isStaffPayPeriodPaid,
  normalizeStaffSalaryAdjustment,
  readStaffBaseSalary,
  readStaffSalaryAdjustments,
  readStaffSalaryPaidMonths,
  staffSalaryBaseKey,
  staffSalaryPaidAtKey,
  staffSalaryPaidToken,
  staffSalaryTransferAtKey,
  staffSalaryTransferRefKey,
  STAFF_SALARY_SETTING_KEYS,
  type StaffPayPeriod,
  type StaffSalaryAdjustment,
  type StaffSalaryOvertimeMeta,
  type StaffSalaryReport
} from "@/lib/staff-salary";
import {
  buildStaff13thMonthReport,
  read13thMonthIncludedMonths,
  serialize13thMonthIncludedMonths,
  staff13thMonthAdjustmentDate,
  staff13thMonthAdjustmentLabel,
  staff13thMonthAdjustmentNote,
  staff13thMonthIncludedMonthsKey,
  staff13thMonthPaidAtKey,
  staff13thMonthTransferAtKey,
  staff13thMonthTransferRefKey,
  type Staff13thMonthReport
} from "@/lib/staff-salary-13th-month";
import {
  buildCashAdvanceAdjustmentsForMonth,
  buildCashAdvanceInstallments,
  markCashAdvanceInstallmentsPaid,
  readStaffCashAdvances,
  reopenCashAdvanceInstallments,
  refreshCashAdvanceStatus,
  STAFF_CASH_ADVANCE_SETTING_KEY,
  type StaffCashAdvance,
  type StaffCashAdvanceTermMonths
} from "@/lib/staff-salary-cash-advance";
import { computeStaffOvertimePay, formatStaffOvertimeNote } from "@/lib/staff-salary-overtime";
import { GL } from "@/lib/gl-config";
import { appendSheetValues, updateSheetValues } from "@/lib/sheets/client";
import { listFieldDispatches } from "@/lib/sheets/field-dispatch";
import { invalidateSettingsCache, readSettingsMap, readSettingsRowIndex } from "@/lib/sheets/settings";
import { resolveStaffSalaryProfile } from "@/lib/sheets/staff-payroll-roster";
import type { StaffSalaryProfile } from "@/lib/staff-salary";

async function requireStaffProfile(accessToken: string, staffId: string): Promise<StaffSalaryProfile> {
  const profile = await resolveStaffSalaryProfile(accessToken, staffId);
  if (!profile) {
    throw new Error("Unknown staff member. Add them on the Payroll roster first.");
  }
  return profile;
}

async function upsertSettingValue(
  accessToken: string,
  key: string,
  value: string,
  rowIndex: Map<string, number>
): Promise<void> {
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(key);
  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[value]]);
    return;
  }
  await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[key, value]]);
}

function readPaidFlags(
  settingsMap: Map<string, string>,
  staffId: string,
  year: number,
  month: number
): {
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
} {
  const paidMonths = readStaffSalaryPaidMonths(settingsMap);
  const paidMid = isStaffPayPeriodPaid(paidMonths, staffId, year, month, "mid");
  const paidEnd = isStaffPayPeriodPaid(paidMonths, staffId, year, month, "end");
  const midTransferredAt = settingsMap.get(staffSalaryTransferAtKey(staffId, year, month, "mid"))?.trim();
  const endTransferredAt = settingsMap.get(staffSalaryTransferAtKey(staffId, year, month, "end"))?.trim();

  return {
    paidMid,
    paidEnd,
    paidMidAt: settingsMap.get(staffSalaryPaidAtKey(staffId, year, month, "mid")),
    paidEndAt: settingsMap.get(staffSalaryPaidAtKey(staffId, year, month, "end")),
    midTransferred: Boolean(midTransferredAt),
    endTransferred: Boolean(endTransferredAt),
    midTransferredAt: midTransferredAt || undefined,
    endTransferredAt: endTransferredAt || undefined,
    midTransferRef: settingsMap.get(staffSalaryTransferRefKey(staffId, year, month, "mid"))?.trim() || undefined,
    endTransferRef: settingsMap.get(staffSalaryTransferRefKey(staffId, year, month, "end"))?.trim() || undefined
  };
}

export async function getStaffSalaryReport(
  accessToken: string,
  staffId: string,
  year: number,
  month: number
): Promise<StaffSalaryReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const [settingsMap, dispatches] = await Promise.all([
    readSettingsMap(accessToken),
    listFieldDispatches(accessToken)
  ]);

  const paid = readPaidFlags(settingsMap, staffId, year, month);
  const fieldDispatch = filterFieldDispatchForStaffMonth(dispatches, profile, year, month);
  const allAdjustments = readStaffSalaryAdjustments(settingsMap);
  const manualAdjustments = filterAdjustmentsForStaffMonth(allAdjustments, staffId, year, month);
  const cashAdvances = readStaffCashAdvances(settingsMap).filter((advance) => advance.staffId === staffId);
  const cashAdvanceAdjustments = buildCashAdvanceAdjustmentsForMonth(cashAdvances, staffId, year, month);

  return buildStaffSalaryReport({
    year,
    month,
    profile,
    baseSalary: readStaffBaseSalary(settingsMap, staffId),
    fieldDispatch,
    adjustments: [...manualAdjustments, ...cashAdvanceAdjustments],
    cashAdvances,
    ...paid
  });
}

export async function saveStaffBaseSalary(
  accessToken: string,
  staffId: string,
  baseSalary: number
): Promise<number> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const amount = Math.round(Number(baseSalary) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid base salary.");
  }

  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(accessToken, staffSalaryBaseKey(staffId), String(amount), rowIndex);
  invalidateSettingsCache(accessToken);
  return amount;
}

export async function recordStaffSalaryAdjustment(
  accessToken: string,
  input: {
    staffId: string;
    label: string;
    amount: number;
    note?: string;
    date?: string;
    kind?: StaffSalaryAdjustment["kind"];
    overtime?: StaffSalaryOvertimeMeta;
  }
): Promise<StaffSalaryAdjustment[]> {
  const profile = await requireStaffProfile(accessToken, input.staffId);

  const label = String(input.label || "").trim();
  if (!label) throw new Error("Enter a label for this adjustment.");

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!amount) throw new Error("Enter a non-zero amount.");

  const note = String(input.note || "").trim();
  const date = String(input.date || new Date().toISOString().slice(0, 10));

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const adjustments = readStaffSalaryAdjustments(settingsMap);
  const entry: StaffSalaryAdjustment = normalizeStaffSalaryAdjustment({
    id: `salary-adj-${Date.now()}`,
    staffId: input.staffId,
    date,
    label,
    amount,
    note,
    kind: input.kind,
    overtime: input.overtime
  });

  adjustments.push(entry);
  await upsertSettingValue(
    accessToken,
    STAFF_SALARY_SETTING_KEYS.adjustments,
    JSON.stringify(adjustments),
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  return adjustments.filter((item) => item.staffId === input.staffId).map(normalizeStaffSalaryAdjustment);
}

async function persistStaffSalaryAdjustments(
  accessToken: string,
  adjustments: StaffSalaryAdjustment[],
  rowIndex: Map<string, number>
): Promise<void> {
  await upsertSettingValue(
    accessToken,
    STAFF_SALARY_SETTING_KEYS.adjustments,
    JSON.stringify(adjustments),
    rowIndex
  );
}

function recomputeOvertimeAdjustment(
  entry: StaffSalaryAdjustment,
  baseSalary: number,
  input: {
    date?: string;
    overtime?: StaffSalaryOvertimeMeta;
  }
): StaffSalaryAdjustment {
  const overtime = input.overtime ?? entry.overtime;
  if (!overtime) throw new Error("Overtime details are missing for this line.");

  const date = String(input.date || entry.date).trim();
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Enter a valid overtime date.");

  const result = computeStaffOvertimePay({
    monthlySalary: baseSalary,
    hours: overtime.hours,
    dayType: overtime.dayType,
    restDaySchedule: overtime.restDays,
    nightShift: overtime.nightShift,
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
    date
  });

  if (result.totalPay <= 0) throw new Error("Overtime amount must be greater than zero.");

  return normalizeStaffSalaryAdjustment({
    ...entry,
    label: "Overtime",
    amount: result.totalPay,
    date,
    note: formatStaffOvertimeNote(result, date),
    kind: "overtime",
    overtime
  });
}

export async function updateStaffSalaryAdjustment(
  accessToken: string,
  input: {
    id: string;
    staffId: string;
    label?: string;
    amount?: number;
    note?: string;
    date?: string;
    overtime?: StaffSalaryOvertimeMeta;
  }
): Promise<StaffSalaryAdjustment[]> {
  const profile = await requireStaffProfile(accessToken, input.staffId);

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const paidMonths = readStaffSalaryPaidMonths(settingsMap);
  const adjustments = readStaffSalaryAdjustments(settingsMap);
  const index = adjustments.findIndex((entry) => entry.id === input.id && entry.staffId === input.staffId);
  if (index < 0) throw new Error("Adjustment not found.");

  const current = adjustments[index];
  assertStaffSalaryAdjustmentEditable(current, paidMonths);

  let next = { ...current };
  if (inferAdjustmentKind(current) === "overtime" || input.overtime) {
    next = recomputeOvertimeAdjustment(current, readStaffBaseSalary(settingsMap, input.staffId), {
      date: input.date,
      overtime: input.overtime ?? current.overtime
    });
  } else if (inferAdjustmentKind(current) === "thirteenthMonth") {
    throw new Error("Update 13th month on the 13th month tab, or remove it from December payroll and post again.");
  } else {
    const label = String(input.label ?? current.label).trim();
    if (!label) throw new Error("Enter a label for this adjustment.");

    const amount = Math.round(Number(input.amount ?? current.amount) * 100) / 100;
    if (!amount) throw new Error("Enter a non-zero amount.");

    next = normalizeStaffSalaryAdjustment({
      ...current,
      label,
      amount,
      date: String(input.date || current.date).trim(),
      note: String(input.note ?? current.note).trim(),
      kind: "manual"
    });
  }

  adjustments[index] = next;
  await persistStaffSalaryAdjustments(accessToken, adjustments, rowIndex);
  invalidateSettingsCache(accessToken);
  return adjustments.filter((item) => item.staffId === input.staffId).map(normalizeStaffSalaryAdjustment);
}

export async function deleteStaffSalaryAdjustment(
  accessToken: string,
  staffId: string,
  id: string
): Promise<StaffSalaryAdjustment[]> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const paidMonths = readStaffSalaryPaidMonths(settingsMap);
  const adjustments = readStaffSalaryAdjustments(settingsMap);
  const target = adjustments.find((entry) => entry.id === id && entry.staffId === staffId);
  if (!target) throw new Error("Adjustment not found.");

  assertStaffSalaryAdjustmentEditable(target, paidMonths);
  const next = adjustments.filter((entry) => entry.id !== id);
  await persistStaffSalaryAdjustments(accessToken, next, rowIndex);
  invalidateSettingsCache(accessToken);
  return next.filter((item) => item.staffId === staffId).map(normalizeStaffSalaryAdjustment);
}

async function saveStaffCashAdvances(
  accessToken: string,
  advances: StaffCashAdvance[],
  rowIndex: Map<string, number>
): Promise<void> {
  await upsertSettingValue(
    accessToken,
    STAFF_CASH_ADVANCE_SETTING_KEY,
    JSON.stringify(advances),
    rowIndex
  );
}

export async function recordStaffCashAdvance(
  accessToken: string,
  input: { staffId: string; amount: number; termMonths: StaffCashAdvanceTermMonths; date?: string; note?: string }
): Promise<StaffCashAdvance[]> {
  const profile = await requireStaffProfile(accessToken, input.staffId);

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid cash advance amount.");
  }

  const termMonths = Number(input.termMonths) === 3 ? 3 : 2;
  const date = String(input.date || new Date().toISOString().slice(0, 10)).trim();
  const note = String(input.note || "").trim();

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const advances = readStaffCashAdvances(settingsMap);
  const entry: StaffCashAdvance = refreshCashAdvanceStatus({
    id: `cash-adv-${Date.now()}`,
    staffId: input.staffId,
    date,
    amount,
    termMonths,
    note,
    status: "active",
    installments: buildCashAdvanceInstallments(amount, termMonths, date),
    createdAt: new Date().toISOString().slice(0, 10)
  });

  advances.push(entry);
  await saveStaffCashAdvances(accessToken, advances, rowIndex);
  invalidateSettingsCache(accessToken);
  return advances.filter((item) => item.staffId === input.staffId);
}

export async function cancelStaffCashAdvance(
  accessToken: string,
  staffId: string,
  advanceId: string
): Promise<StaffCashAdvance[]> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const advances = readStaffCashAdvances(settingsMap);
  const target = advances.find((advance) => advance.id === advanceId && advance.staffId === staffId);
  if (!target) throw new Error("Cash advance not found.");
  if (target.status === "cancelled") throw new Error("This cash advance is already cancelled.");
  if (target.installments.some((installment) => installment.paidAt)) {
    throw new Error("Cannot cancel a cash advance after repayments have started.");
  }

  const next = advances.map((advance) =>
    advance.id === advanceId && advance.staffId === staffId
      ? refreshCashAdvanceStatus({ ...advance, status: "cancelled" })
      : advance
  );
  await saveStaffCashAdvances(accessToken, next, rowIndex);
  invalidateSettingsCache(accessToken);
  return next.filter((item) => item.staffId === staffId);
}

export async function updateStaffCashAdvance(
  accessToken: string,
  input: {
    staffId: string;
    advanceId: string;
    amount?: number;
    termMonths?: StaffCashAdvanceTermMonths;
    date?: string;
    note?: string;
  }
): Promise<StaffCashAdvance[]> {
  const profile = await requireStaffProfile(accessToken, input.staffId);

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const advances = readStaffCashAdvances(settingsMap);
  const index = advances.findIndex(
    (advance) => advance.id === input.advanceId && advance.staffId === input.staffId
  );
  if (index < 0) throw new Error("Cash advance not found.");

  const current = advances[index];
  if (current.status === "cancelled") throw new Error("Cancelled cash advances cannot be edited.");
  if (current.installments.some((installment) => installment.paidAt)) {
    throw new Error("Cannot edit a cash advance after repayments have started.");
  }

  const amount = Math.round(Number(input.amount ?? current.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid cash advance amount.");
  }

  const termMonths = Number(input.termMonths ?? current.termMonths) === 3 ? 3 : 2;
  const date = String(input.date || current.date).trim();
  const note = String(input.note ?? current.note).trim();

  advances[index] = refreshCashAdvanceStatus({
    ...current,
    amount,
    termMonths,
    date,
    note,
    status: "active",
    installments: buildCashAdvanceInstallments(amount, termMonths, date)
  });

  await saveStaffCashAdvances(accessToken, advances, rowIndex);
  invalidateSettingsCache(accessToken);
  return advances.filter((item) => item.staffId === input.staffId);
}

async function syncCashAdvancesForPayRun(
  accessToken: string,
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod,
  mode: "mark" | "reopen"
): Promise<void> {
  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const advances = readStaffCashAdvances(settingsMap);
  const paidAt = new Date().toISOString().slice(0, 10);
  const next =
    mode === "mark"
      ? markCashAdvanceInstallmentsPaid(advances, staffId, year, month, period, paidAt)
      : reopenCashAdvanceInstallments(advances, staffId, year, month, period);

  if (JSON.stringify(next) === JSON.stringify(advances)) return;
  await saveStaffCashAdvances(accessToken, next, rowIndex);
}

export async function markStaffSalaryPaid(
  accessToken: string,
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): Promise<StaffSalaryReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const report = await getStaffSalaryReport(accessToken, staffId, year, month);
  const alreadyPaid = period === "mid" ? report.midMonthPaid : report.endMonthPaid;
  if (alreadyPaid) {
    throw new Error(`${report.monthLabel} ${period === "mid" ? "mid-month" : "end-of-month"} pay is already marked.`);
  }

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const paid = readStaffSalaryPaidMonths(settingsMap);
  paid.add(staffSalaryPaidToken(staffId, year, month, period));

  await upsertSettingValue(
    accessToken,
    STAFF_SALARY_SETTING_KEYS.paidMonths,
    [...paid].sort().join(","),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    staffSalaryPaidAtKey(staffId, year, month, period),
    new Date().toISOString().slice(0, 10),
    rowIndex
  );

  await syncCashAdvancesForPayRun(accessToken, staffId, year, month, period, "mark");

  invalidateSettingsCache(accessToken);
  return getStaffSalaryReport(accessToken, staffId, year, month);
}

export async function reopenStaffSalaryMonth(
  accessToken: string,
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod
): Promise<StaffSalaryReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const report = await getStaffSalaryReport(accessToken, staffId, year, month);
  const isPaid = period === "mid" ? report.midMonthPaid : report.endMonthPaid;
  if (!isPaid) {
    throw new Error(`${report.monthLabel} ${period === "mid" ? "mid-month" : "end-of-month"} pay is not marked.`);
  }

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const paid = readStaffSalaryPaidMonths(settingsMap);
  paid.delete(staffSalaryPaidToken(staffId, year, month, period));
  paid.delete(staffSalaryPaidToken(staffId, year, month));

  await upsertSettingValue(
    accessToken,
    STAFF_SALARY_SETTING_KEYS.paidMonths,
    [...paid].sort().join(","),
    rowIndex
  );
  await upsertSettingValue(accessToken, staffSalaryPaidAtKey(staffId, year, month, period), "", rowIndex);
  await upsertSettingValue(accessToken, staffSalaryTransferAtKey(staffId, year, month, period), "", rowIndex);
  await upsertSettingValue(accessToken, staffSalaryTransferRefKey(staffId, year, month, period), "", rowIndex);

  await syncCashAdvancesForPayRun(accessToken, staffId, year, month, period, "reopen");

  invalidateSettingsCache(accessToken);
  return getStaffSalaryReport(accessToken, staffId, year, month);
}

export async function markStaffSalaryTransferred(
  accessToken: string,
  staffId: string,
  year: number,
  month: number,
  period: StaffPayPeriod,
  transferRef: string
): Promise<StaffSalaryReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const report = await getStaffSalaryReport(accessToken, staffId, year, month);
  const isPaid = period === "mid" ? report.midMonthPaid : report.endMonthPaid;
  if (!isPaid) {
    throw new Error("Record the pay run as paid before marking the bank transfer.");
  }
  const run = report.payRuns.find((entry) => entry.period === period);
  if (run?.transferred) {
    throw new Error("This pay run is already marked as transferred.");
  }

  const rowIndex = await readSettingsRowIndex(accessToken);
  const ref = transferRef.trim() || `BPI ${new Date().toISOString().slice(0, 10)}`;
  await upsertSettingValue(
    accessToken,
    staffSalaryTransferAtKey(staffId, year, month, period),
    new Date().toISOString().slice(0, 10),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    staffSalaryTransferRefKey(staffId, year, month, period),
    ref,
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  return getStaffSalaryReport(accessToken, staffId, year, month);
}

function read13thMonthPaidFlags(
  settingsMap: Map<string, string>,
  staffId: string,
  year: number
): {
  paid: boolean;
  paidAt?: string;
  transferred: boolean;
  transferredAt?: string;
  transferRef?: string;
} {
  const paidAt = settingsMap.get(staff13thMonthPaidAtKey(staffId, year))?.trim();
  const transferredAt = settingsMap.get(staff13thMonthTransferAtKey(staffId, year))?.trim();

  return {
    paid: Boolean(paidAt),
    paidAt: paidAt || undefined,
    transferred: Boolean(transferredAt),
    transferredAt: transferredAt || undefined,
    transferRef: settingsMap.get(staff13thMonthTransferRefKey(staffId, year))?.trim() || undefined
  };
}

export async function getStaff13thMonthReport(
  accessToken: string,
  staffId: string,
  year: number
): Promise<Staff13thMonthReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const settingsMap = await readSettingsMap(accessToken);
  const includedMonths = read13thMonthIncludedMonths(settingsMap, staffId, year);
  const paid = read13thMonthPaidFlags(settingsMap, staffId, year);
  const payrollAdjustment = findStaff13thMonthAdjustment(readStaffSalaryAdjustments(settingsMap), staffId, year);

  return buildStaff13thMonthReport({
    year,
    profile,
    monthlyBaseSalary: readStaffBaseSalary(settingsMap, staffId),
    includedMonths,
    postedToPayroll: Boolean(payrollAdjustment),
    payrollAdjustmentId: payrollAdjustment?.id,
    ...paid
  });
}

export async function saveStaff13thMonthIncludedMonths(
  accessToken: string,
  staffId: string,
  year: number,
  months: number[]
): Promise<Staff13thMonthReport> {
  const profile = await requireStaffProfile(accessToken, staffId);

  const serialized = serialize13thMonthIncludedMonths(months);
  if (!serialized) throw new Error("Select at least one month to include.");

  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(
    accessToken,
    staff13thMonthIncludedMonthsKey(staffId, year),
    serialized,
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  let report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (report.postedToPayroll) {
    const synced = await syncStaff13thMonthPayrollAdjustment(accessToken, staffId, year);
    report = synced.report;
  }
  return report;
}

export async function markStaff13thMonthPaid(
  accessToken: string,
  staffId: string,
  year: number
): Promise<Staff13thMonthReport> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (report.paid) throw new Error(`${year} 13th month pay is already marked for ${report.staffName}.`);
  if (report.thirteenthMonthPay <= 0) throw new Error("13th month pay amount must be greater than zero.");

  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(
    accessToken,
    staff13thMonthPaidAtKey(staffId, year),
    new Date().toISOString().slice(0, 10),
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  return getStaff13thMonthReport(accessToken, staffId, year);
}

export async function reopenStaff13thMonth(
  accessToken: string,
  staffId: string,
  year: number
): Promise<Staff13thMonthReport> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (!report.paid) throw new Error(`${year} 13th month pay is not marked for ${report.staffName}.`);

  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(accessToken, staff13thMonthPaidAtKey(staffId, year), "", rowIndex);
  await upsertSettingValue(accessToken, staff13thMonthTransferAtKey(staffId, year), "", rowIndex);
  await upsertSettingValue(accessToken, staff13thMonthTransferRefKey(staffId, year), "", rowIndex);

  invalidateSettingsCache(accessToken);
  return getStaff13thMonthReport(accessToken, staffId, year);
}

export async function markStaff13thMonthTransferred(
  accessToken: string,
  staffId: string,
  year: number,
  transferRef: string
): Promise<Staff13thMonthReport> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (!report.paid) throw new Error("Record 13th month pay before marking the bank transfer.");
  if (report.transferred) throw new Error("13th month pay is already marked as transferred.");

  const rowIndex = await readSettingsRowIndex(accessToken);
  const ref = transferRef.trim() || `BPI ${new Date().toISOString().slice(0, 10)}`;
  await upsertSettingValue(
    accessToken,
    staff13thMonthTransferAtKey(staffId, year),
    new Date().toISOString().slice(0, 10),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    staff13thMonthTransferRefKey(staffId, year),
    ref,
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  return getStaff13thMonthReport(accessToken, staffId, year);
}

export async function postStaff13thMonthAdjustment(
  accessToken: string,
  staffId: string,
  year: number
): Promise<{ report: Staff13thMonthReport; message: string }> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (report.thirteenthMonthPay <= 0) throw new Error("13th month pay amount must be greater than zero.");

  const settingsMap = await readSettingsMap(accessToken);
  const adjustments = readStaffSalaryAdjustments(settingsMap);
  const label = staff13thMonthAdjustmentLabel(year);
  const duplicate = adjustments.some(
    (entry) =>
      entry.staffId === staffId &&
      entry.label.trim().toLowerCase() === label.toLowerCase() &&
      entry.date.startsWith(`${year}-`)
  );
  if (duplicate) {
    throw new Error(`${label} is already posted as a December payroll adjustment.`);
  }

  await recordStaffSalaryAdjustment(accessToken, {
    staffId,
    label,
    amount: report.thirteenthMonthPay,
    date: staff13thMonthAdjustmentDate(year),
    note: staff13thMonthAdjustmentNote(report),
    kind: "thirteenthMonth"
  });

  invalidateSettingsCache(accessToken);
  return {
    report: await getStaff13thMonthReport(accessToken, staffId, year),
    message: `${label} posted to December payroll for ${report.staffName}.`
  };
}

export async function syncStaff13thMonthPayrollAdjustment(
  accessToken: string,
  staffId: string,
  year: number
): Promise<{ report: Staff13thMonthReport; message: string }> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (!report.postedToPayroll || !report.payrollAdjustmentId) {
    throw new Error("13th month pay is not posted to December payroll yet.");
  }
  if (report.thirteenthMonthPay <= 0) throw new Error("13th month pay amount must be greater than zero.");

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const paidMonths = readStaffSalaryPaidMonths(settingsMap);
  const adjustments = readStaffSalaryAdjustments(settingsMap);
  const index = adjustments.findIndex((entry) => entry.id === report.payrollAdjustmentId);
  if (index < 0) throw new Error("December payroll line for 13th month pay was not found.");

  assertStaffSalaryAdjustmentEditable(adjustments[index], paidMonths);

  adjustments[index] = normalizeStaffSalaryAdjustment({
    ...adjustments[index],
    label: staff13thMonthAdjustmentLabel(year),
    amount: report.thirteenthMonthPay,
    date: staff13thMonthAdjustmentDate(year),
    note: staff13thMonthAdjustmentNote(report),
    kind: "thirteenthMonth"
  });

  await persistStaffSalaryAdjustments(accessToken, adjustments, rowIndex);
  invalidateSettingsCache(accessToken);
  return {
    report: await getStaff13thMonthReport(accessToken, staffId, year),
    message: "December payroll line updated from the latest 13th month computation."
  };
}

export async function removeStaff13thMonthPayrollAdjustment(
  accessToken: string,
  staffId: string,
  year: number
): Promise<{ report: Staff13thMonthReport; message: string }> {
  const report = await getStaff13thMonthReport(accessToken, staffId, year);
  if (!report.postedToPayroll || !report.payrollAdjustmentId) {
    throw new Error("13th month pay is not posted to December payroll.");
  }

  await deleteStaffSalaryAdjustment(accessToken, staffId, report.payrollAdjustmentId);
  return {
    report: await getStaff13thMonthReport(accessToken, staffId, year),
    message: "Removed 13th month pay from December payroll."
  };
}
