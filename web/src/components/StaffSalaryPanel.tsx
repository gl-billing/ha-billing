"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { FIRM_ADDRESS, FIRM_NAME, FIRM_SUBTITLE } from "@/lib/billing-document-design";
import { firmLogoPublicUrl } from "@/lib/firm-logo-url";
import { formatPeso } from "@/lib/gl-config";
import { openPrintPreview } from "@/lib/print-preview";
import {
  buildStaffSalaryComputation,
  formatStaffSalaryStatementText,
  formatStaffPayrollTransferMemo,
  splitBaseSalaryForSemiMonthly,
  formatStaffPayrollAccount,
  staffSalaryPayslipReference,
  inferAdjustmentKind,
  isSyntheticCashAdvanceAdjustmentId,
  staffPayPeriodForDate,
  type StaffPayPeriod,
  type StaffSalaryAdjustment,
  type StaffSalaryComputeRow,
  type StaffSalaryReport
} from "@/lib/staff-salary";
import {
  cashAdvanceRemainingBalance,
  formatCashAdvanceScheduleLabel,
  type StaffCashAdvance,
  type StaffCashAdvanceTermMonths
} from "@/lib/staff-salary-cash-advance";
import {
  payReleaseComputeRows,
  StaffSalaryPayReleaseCard
} from "@/components/staff-salary/StaffSalaryPayReleaseCard";
import {
  StaffPayslipEmailPreviewDialog,
  type StaffPayslipEmailPreview
} from "@/components/staff-salary/StaffPayslipEmailPreviewDialog";
import {
  computeStaffOvertimePay,
  formatStaffOvertimeNote,
  laborCodeAnnualWorkingDays,
  laborCodeDailyRate,
  laborCodeHourlyRate,
  laborCodeOvertimeFormulaText,
  laborCodeRestDayDivisorNote,
  STAFF_OVERTIME_DAY_TYPES,
  STAFF_OVERTIME_REST_DAY_SCHEDULES,
  yearlySalaryFromMonthly,
  type StaffOvertimeDayType,
  type StaffOvertimeRestDaySchedule
} from "@/lib/staff-salary-overtime";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { MatterLink } from "@/components/MatterLink";
import { Staff13thMonthPanel } from "@/components/Staff13thMonthPanel";
import {
  StaffSalaryActions,
  StaffSalaryComputeSheet,
  StaffSalaryField,
  StaffSalaryFormGrid,
  StaffSalaryRateCards,
  StaffSalaryResultHero,
  StaffSalarySetupBar,
  StaffSalaryToolPanel,
  StaffSalaryToolTabs,
  StaffSalaryEntryActions,
  type StaffSalaryToolTab
} from "@/components/staff-salary/StaffSalaryComputeUI";
import { StaffPayrollRosterPanel } from "@/components/staff-salary/StaffPayrollRosterPanel";
import { FirmLawyersRosterPanel } from "@/components/staff-salary/FirmLawyersRosterPanel";
import type { StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";
import type { FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";

type Props = {
  busy: boolean;
  onStatus: (message: string, isError?: boolean) => void;
};

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function formatComputeAmount(row: StaffSalaryComputeRow): string {
  if (row.amount === null) return "—";
  if (row.tone === "deduct" || row.amount < 0) {
    return `−${formatPeso(Math.abs(row.amount))}`;
  }
  return formatPeso(row.amount);
}

function computeRowClass(row: StaffSalaryComputeRow): string {
  if (row.tone === "total") return "staff-salary__compute-amount staff-salary__compute-amount--total amount-serif";
  if (row.tone === "subtotal") return "staff-salary__compute-amount staff-salary__compute-amount--subtotal amount-serif";
  if (row.tone === "deduct" || (row.amount !== null && row.amount < 0)) {
    return "staff-salary__compute-amount staff-salary__compute-amount--deduct amount-serif";
  }
  return "staff-salary__compute-amount amount-serif";
}

function payslipReference(report: StaffSalaryReport): string {
  return staffSalaryPayslipReference(report);
}

function isPayrollLineLocked(report: StaffSalaryReport, entry: StaffSalaryAdjustment): boolean {
  const parsed = new Date(entry.date);
  if (Number.isNaN(parsed.getTime())) return true;
  if (parsed.getFullYear() !== report.year || parsed.getMonth() + 1 !== report.month) return false;
  const period = staffPayPeriodForDate(report.year, report.month, entry.date);
  return period === "mid" ? report.midMonthPaid : report.endMonthPaid;
}

export function StaffSalaryPanel({ busy, onStatus }: Props) {
  const now = new Date();
  const [staffId, setStaffId] = useState("");
  const [roster, setRoster] = useState<StaffPayrollRosterEntry[]>([]);
  const [lawyers, setLawyers] = useState<FirmLawyerRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<StaffSalaryReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [savingBase, setSavingBase] = useState(false);
  const [closingPeriod, setClosingPeriod] = useState<StaffPayPeriod | "">("");
  const [reopeningPeriod, setReopeningPeriod] = useState<StaffPayPeriod | "">("");
  const [transferringPeriod, setTransferringPeriod] = useState<StaffPayPeriod | "">("");
  const [emailingPeriod, setEmailingPeriod] = useState<StaffPayPeriod | "">("");
  const [previewingPeriod, setPreviewingPeriod] = useState<StaffPayPeriod | "">("");
  const [payslipPreviewPeriod, setPayslipPreviewPeriod] = useState<StaffPayPeriod | "">("");
  const [payslipPreview, setPayslipPreview] = useState<StaffPayslipEmailPreview | null>(null);
  const [payslipPreviewLoading, setPayslipPreviewLoading] = useState(false);
  const [payslipPreviewError, setPayslipPreviewError] = useState("");
  const [transferRefByPeriod, setTransferRefByPeriod] = useState<Record<StaffPayPeriod, string>>({
    mid: "",
    end: ""
  });
  const [adjustLabel, setAdjustLabel] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjusting, setAdjusting] = useState(false);
  const [otHours, setOtHours] = useState("");
  const [otDate, setOtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [otDayType, setOtDayType] = useState<StaffOvertimeDayType>("ordinary");
  const [otRestDays, setOtRestDays] = useState<StaffOvertimeRestDaySchedule>("satAndSun");
  const [otNightShift, setOtNightShift] = useState(false);
  const [postingOvertime, setPostingOvertime] = useState(false);
  const [adminTab, setAdminTab] = useState<StaffSalaryToolTab>("overtime");
  const [caAmount, setCaAmount] = useState("");
  const [caDate, setCaDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [caTermMonths, setCaTermMonths] = useState<StaffCashAdvanceTermMonths>(2);
  const [caNote, setCaNote] = useState("");
  const [caRecording, setCaRecording] = useState(false);
  const [caCancellingId, setCaCancellingId] = useState("");
  const [editingAdjustmentId, setEditingAdjustmentId] = useState("");
  const [deletingAdjustmentId, setDeletingAdjustmentId] = useState("");
  const [editingOvertimeId, setEditingOvertimeId] = useState("");
  const [deletingOvertimeId, setDeletingOvertimeId] = useState("");
  const [editingCashAdvanceId, setEditingCashAdvanceId] = useState("");

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const [staffRes, lawyersRes] = await Promise.all([
        fetch("/api/staff-salary/roster"),
        fetch("/api/firm-lawyers/roster")
      ]);
      const staffJson = await staffRes.json();
      const lawyersJson = await lawyersRes.json();
      if (!staffRes.ok) throw new Error(staffJson.error || "Failed to load payroll roster.");
      if (!lawyersRes.ok) throw new Error(lawyersJson.error || "Failed to load lawyers roster.");
      const nextStaff = (staffJson.roster || []) as StaffPayrollRosterEntry[];
      const nextLawyers = (lawyersJson.roster || []) as FirmLawyerRosterEntry[];
      setRoster(nextStaff);
      setLawyers(nextLawyers);
      setStaffId((current) => {
        if (current && nextStaff.some((entry) => entry.id === current)) return current;
        return nextStaff[0]?.id || "";
      });
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to load team roster.", true);
      setRoster([]);
      setLawyers([]);
      setStaffId("");
    } finally {
      setRosterLoading(false);
    }
  }, [onStatus]);

  const loadReport = useCallback(async () => {
    if (!staffId) {
      setReport(null);
      setReportLoading(false);
      setReportError("");
      return;
    }
    setReportLoading(true);
    setReportError("");
    try {
      const res = await fetch(
        `/api/staff-salary?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load staff salary.");
      const nextReport = json as StaffSalaryReport;
      setReport(nextReport);
      setBaseSalary(String(nextReport.baseSalary || ""));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load staff salary.";
      setReportError(msg);
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [staffId, year, month]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const parsed = new Date(today);
    if (parsed.getFullYear() === year && parsed.getMonth() + 1 === month) {
      setOtDate(today);
      setAdjustDate(today);
      return;
    }
    const fallback = `${year}-${String(month).padStart(2, "0")}-15`;
    setOtDate(fallback);
    setAdjustDate(fallback);
  }, [year, month]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") {
        const prev = shiftMonth(year, month, -1);
        setYear(prev.year);
        setMonth(prev.month);
      }
      if (event.key === "ArrowRight") {
        const next = shiftMonth(year, month, 1);
        setYear(next.year);
        setMonth(next.month);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [year, month]);

  async function saveBaseSalary() {
    setSavingBase(true);
    try {
      const res = await fetch("/api/staff-salary/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, baseSalary: Number(baseSalary) })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save base salary.");
      onStatus(json.message || "Base salary saved.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save base salary.", true);
    } finally {
      setSavingBase(false);
    }
  }

  async function submitAdjustment() {
    if (!adjustLabel.trim()) {
      onStatus("Enter a label for this adjustment.", true);
      return;
    }
    if (!Number(adjustAmount)) {
      onStatus("Enter a non-zero adjustment amount.", true);
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch("/api/staff-salary/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          label: adjustLabel.trim(),
          amount: Number(adjustAmount),
          note: adjustNote.trim(),
          date: adjustDate
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record adjustment.");
      setAdjustLabel("");
      setAdjustAmount("");
      setAdjustNote("");
      onStatus(json.message || "Adjustment recorded.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record adjustment.", true);
    } finally {
      setAdjusting(false);
    }
  }

  async function submitCashAdvance() {
    const amount = Number(caAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      onStatus("Enter a valid cash advance amount.", true);
      return;
    }
    setCaRecording(true);
    try {
      const res = await fetch("/api/staff-salary/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingCashAdvanceId
            ? {
                action: "update",
                staffId,
                advanceId: editingCashAdvanceId,
                amount,
                termMonths: caTermMonths,
                date: caDate,
                note: caNote.trim()
              }
            : {
                staffId,
                amount,
                termMonths: caTermMonths,
                date: caDate,
                note: caNote.trim()
              }
        )
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save cash advance.");
      const wasEditing = Boolean(editingCashAdvanceId);
      cancelEditCashAdvance();
      onStatus(json.message || (wasEditing ? "Cash advance updated." : "Cash advance recorded."));
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save cash advance.", true);
    } finally {
      setCaRecording(false);
    }
  }

  async function cancelCashAdvance(advanceId: string) {
    setCaCancellingId(advanceId);
    try {
      const res = await fetch("/api/staff-salary/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          staffId,
          advanceId
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not cancel cash advance.");
      onStatus(json.message || "Cash advance cancelled.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not cancel cash advance.", true);
    } finally {
      setCaCancellingId("");
    }
  }

  const otWorkingDays = laborCodeAnnualWorkingDays(otRestDays);

  const overtimePreview = useMemo(() => {
    if (!report) return null;
    const hours = Number(otHours);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return computeStaffOvertimePay({
      monthlySalary: report.baseSalary,
      hours,
      date: otDate,
      year,
      month,
      dayType: otDayType,
      nightShift: otNightShift,
      restDaySchedule: otRestDays
    });
  }, [report, otHours, otDate, year, month, otDayType, otNightShift, otRestDays]);

  const overtimeRateCards = useMemo(() => {
    if (!report?.baseSalary) return [];
    const yearly = yearlySalaryFromMonthly(report.baseSalary);
    return [
      { label: "Yearly basic", value: formatPeso(yearly), hint: "Monthly base × 12" },
      {
        label: "Daily rate",
        value: formatPeso(laborCodeDailyRate(yearly, otWorkingDays)),
        hint: `Yearly ÷ ${otWorkingDays}`
      },
      {
        label: "Hourly rate",
        value: formatPeso(laborCodeHourlyRate(yearly, otWorkingDays)),
        hint: "Daily ÷ 8 hours"
      }
    ];
  }, [report?.baseSalary, otWorkingDays]);

  const overtimeComputeRows = useMemo(() => {
    if (!overtimePreview) return [];
    const nightNote = overtimePreview.nightShift ? " · night +10%" : "";
    return [
      {
        label: "1 · Yearly basic",
        detail: `${formatPeso(overtimePreview.monthlySalary)} × 12`,
        amount: formatPeso(overtimePreview.yearlySalary)
      },
      {
        label: "2 · Daily rate",
        detail: `${formatPeso(overtimePreview.yearlySalary)} ÷ ${overtimePreview.workingDays}${nightNote}`,
        amount: formatPeso(overtimePreview.dailyRate),
        tone: "muted" as const
      },
      {
        label: "3 · Hourly rate",
        detail: `${formatPeso(overtimePreview.dailyRate)} ÷ 8`,
        amount: formatPeso(overtimePreview.hourlyRate),
        tone: "muted" as const
      },
      {
        label: "4 · OT hourly rate",
        detail: `${overtimePreview.dayTypeLabel} × ${overtimePreview.dayMultiplier}${overtimePreview.nightShift ? " × 1.1" : ""}`,
        amount: `${formatPeso(overtimePreview.overtimeHourlyRate)}/hr`,
        tone: "subtotal" as const
      },
      {
        label: "5 · Overtime pay",
        detail: `${formatPeso(overtimePreview.overtimeHourlyRate)} × ${overtimePreview.hours} hr${overtimePreview.hours === 1 ? "" : "s"} · ${overtimePreview.payPeriodLabel}`,
        amount: formatPeso(overtimePreview.totalPay),
        tone: "total" as const
      }
    ];
  }, [overtimePreview]);

  const manualAdjustments = useMemo(
    () =>
      report?.adjustments.filter(
        (entry) =>
          !isSyntheticCashAdvanceAdjustmentId(entry.id) && inferAdjustmentKind(entry) === "manual"
      ) ?? [],
    [report]
  );

  const overtimeAdjustments = useMemo(
    () =>
      report?.adjustments.filter(
        (entry) =>
          !isSyntheticCashAdvanceAdjustmentId(entry.id) && inferAdjustmentKind(entry) === "overtime"
      ) ?? [],
    [report]
  );

  async function deleteAdjustmentEntry(id: string) {
    if (!window.confirm("Delete this payroll line?")) return;
    setDeletingAdjustmentId(id);
    try {
      const res = await fetch(
        `/api/staff-salary/adjustments?id=${encodeURIComponent(id)}&staffId=${encodeURIComponent(staffId)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete adjustment.");
      if (editingAdjustmentId === id) {
        setEditingAdjustmentId("");
        setAdjustLabel("");
        setAdjustAmount("");
        setAdjustNote("");
      }
      onStatus(json.message || "Adjustment deleted.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not delete adjustment.", true);
    } finally {
      setDeletingAdjustmentId("");
    }
  }

  function startEditAdjustment(entry: StaffSalaryAdjustment) {
    setEditingAdjustmentId(entry.id);
    setAdjustLabel(entry.label);
    setAdjustAmount(String(entry.amount));
    setAdjustNote(entry.note);
    setAdjustDate(entry.date);
  }

  function cancelEditAdjustment() {
    setEditingAdjustmentId("");
    setAdjustLabel("");
    setAdjustAmount("");
    setAdjustNote("");
    setAdjustDate(new Date().toISOString().slice(0, 10));
  }

  async function saveEditAdjustment() {
    if (!editingAdjustmentId) return;
    if (!adjustLabel.trim()) {
      onStatus("Enter a label for this adjustment.", true);
      return;
    }
    if (!Number(adjustAmount)) {
      onStatus("Enter a non-zero adjustment amount.", true);
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch("/api/staff-salary/adjustments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAdjustmentId,
          staffId,
          label: adjustLabel.trim(),
          amount: Number(adjustAmount),
          note: adjustNote.trim(),
          date: adjustDate
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update adjustment.");
      cancelEditAdjustment();
      onStatus(json.message || "Adjustment updated.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not update adjustment.", true);
    } finally {
      setAdjusting(false);
    }
  }

  function startEditOvertime(entry: StaffSalaryAdjustment) {
    setEditingOvertimeId(entry.id);
    setOtDate(entry.date);
    if (entry.overtime) {
      setOtHours(String(entry.overtime.hours));
      setOtDayType(entry.overtime.dayType);
      setOtRestDays(entry.overtime.restDays);
      setOtNightShift(entry.overtime.nightShift);
    }
  }

  function cancelEditOvertime() {
    setEditingOvertimeId("");
    setOtHours("");
    setOtDate(new Date().toISOString().slice(0, 10));
    setOtDayType("ordinary");
    setOtRestDays("sundayOnly");
    setOtNightShift(false);
  }

  async function saveEditOvertime() {
    if (!editingOvertimeId || !report) return;
    const hours = Number(otHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      onStatus("Enter valid overtime hours.", true);
      return;
    }
    setPostingOvertime(true);
    try {
      const res = await fetch("/api/staff-salary/adjustments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingOvertimeId,
          staffId,
          date: otDate,
          overtime: {
            hours,
            dayType: otDayType,
            restDays: otRestDays,
            nightShift: otNightShift
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update overtime.");
      cancelEditOvertime();
      onStatus(json.message || "Overtime updated.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not update overtime.", true);
    } finally {
      setPostingOvertime(false);
    }
  }

  async function deleteOvertimeEntry(id: string) {
    if (!window.confirm("Delete this overtime line?")) return;
    setDeletingOvertimeId(id);
    try {
      const res = await fetch(
        `/api/staff-salary/adjustments?id=${encodeURIComponent(id)}&staffId=${encodeURIComponent(staffId)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete overtime.");
      if (editingOvertimeId === id) cancelEditOvertime();
      onStatus(json.message || "Overtime deleted.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not delete overtime.", true);
    } finally {
      setDeletingOvertimeId("");
    }
  }

  function startEditCashAdvance(advance: StaffCashAdvance) {
    setEditingCashAdvanceId(advance.id);
    setCaAmount(String(advance.amount));
    setCaDate(advance.date);
    setCaTermMonths(advance.termMonths);
    setCaNote(advance.note);
  }

  function cancelEditCashAdvance() {
    setEditingCashAdvanceId("");
    setCaAmount("");
    setCaNote("");
    setCaDate(new Date().toISOString().slice(0, 10));
    setCaTermMonths(2);
  }

  async function postOvertimeAdjustment() {
    if (!report || !overtimePreview) {
      onStatus("Enter overtime hours to compute pay.", true);
      return;
    }
    if (overtimePreview.totalPay <= 0) {
      onStatus("Overtime amount must be greater than zero.", true);
      return;
    }
    if (
      !window.confirm(
        `Post overtime of ${formatPeso(overtimePreview.totalPay)} for ${report.staffName}? (${overtimePreview.hours} hr${overtimePreview.hours === 1 ? "" : "s"} · ${overtimePreview.payPeriodLabel})`
      )
    ) {
      return;
    }
    setPostingOvertime(true);
    try {
      const res = await fetch("/api/staff-salary/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          label: "Overtime",
          amount: overtimePreview.totalPay,
          date: otDate,
          note: formatStaffOvertimeNote(overtimePreview, otDate),
          kind: "overtime",
          overtime: {
            hours: overtimePreview.hours,
            dayType: otDayType,
            restDays: otRestDays,
            nightShift: otNightShift
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record overtime.");
      setOtHours("");
      onStatus(json.message || "Overtime recorded.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record overtime.", true);
    } finally {
      setPostingOvertime(false);
    }
  }

  async function markPaid(period: StaffPayPeriod) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run) return;
    if (
      !window.confirm(
        `Record ${run.label.toLowerCase()} (${run.payDateLabel}) as paid for ${report.staffName}? Amount: ${formatPeso(run.amount)}`
      )
    ) {
      return;
    }
    setClosingPeriod(period);
    try {
      const res = await fetch("/api/staff-salary/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year, month, period })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark pay run.");
      setReport(json.report as StaffSalaryReport);
      onStatus(json.message || "Pay run marked.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not mark pay run.", true);
    } finally {
      setClosingPeriod("");
    }
  }

  async function reopenPayRun(period: StaffPayPeriod) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run?.paid) return;
    if (!window.confirm(`Reopen ${run.label.toLowerCase()} for ${report.staffName}?`)) return;
    setReopeningPeriod(period);
    try {
      const res = await fetch("/api/staff-salary/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year, month, period })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reopen pay run.");
      setReport(json.report as StaffSalaryReport);
      onStatus(json.message || "Pay run reopened.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not reopen pay run.", true);
    } finally {
      setReopeningPeriod("");
    }
  }

  async function copyStatement() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatStaffSalaryStatementText(report));
      onStatus("Payroll statement copied.");
    } catch {
      onStatus("Could not copy statement.", true);
    }
  }

  async function copyTransferMemo(period: StaffPayPeriod) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run) return;
    try {
      await navigator.clipboard.writeText(formatStaffPayrollTransferMemo(report, run));
      onStatus("Bank transfer memo copied.");
    } catch {
      onStatus("Could not copy bank memo.", true);
    }
  }

  async function markTransferred(period: StaffPayPeriod) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run?.paid) {
      onStatus("Record payment before marking bank transfer.", true);
      return;
    }
    if (run.transferred) return;
    setTransferringPeriod(period);
    try {
      const res = await fetch("/api/staff-salary/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          year,
          month,
          period,
          transferRef: transferRefByPeriod[period]
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark transfer.");
      setReport(json.report as StaffSalaryReport);
      onStatus(json.message || "Transfer recorded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not mark transfer.", true);
    } finally {
      setTransferringPeriod("");
    }
  }

  async function emailPayslip(period: StaffPayPeriod, options?: { skipConfirm?: boolean }) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run) return;
    if (!run.paid) {
      onStatus("Record payment before emailing the payslip.", true);
      return;
    }
    if (
      !options?.skipConfirm &&
      !window.confirm(
        `Email ${run.label.toLowerCase()} payslip to ${report.staffName}? Only this pay run (${formatPeso(run.amount)} · ${run.payDateLabel}) will be included — not the other half of the month.`
      )
    ) {
      return;
    }
    setEmailingPeriod(period);
    try {
      const res = await fetch("/api/staff-salary/email-payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year, month, period })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not email payslip.");
      onStatus(json.message || "Payslip emailed.");
      return true;
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not email payslip.", true);
      return false;
    } finally {
      setEmailingPeriod("");
    }
  }

  async function previewPayslip(period: StaffPayPeriod) {
    if (!report) return;
    const run = report.payRuns.find((entry) => entry.period === period);
    if (!run?.paid) {
      onStatus("Record payment before previewing the payslip.", true);
      return;
    }
    setPayslipPreviewPeriod(period);
    setPayslipPreview(null);
    setPayslipPreviewError("");
    setPayslipPreviewLoading(true);
    setPreviewingPeriod(period);
    try {
      const res = await fetch(
        `/api/staff-salary/email-payslip?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}&period=${period}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load payslip preview.");
      setPayslipPreview(json as StaffPayslipEmailPreview);
    } catch (error) {
      setPayslipPreviewError(error instanceof Error ? error.message : "Could not load payslip preview.");
    } finally {
      setPayslipPreviewLoading(false);
      setPreviewingPeriod("");
    }
  }

  function closePayslipPreview() {
    if (emailingPeriod) return;
    setPayslipPreviewPeriod("");
    setPayslipPreview(null);
    setPayslipPreviewError("");
  }

  async function sendPayslipFromPreview() {
    if (!payslipPreviewPeriod) return;
    const sent = await emailPayslip(payslipPreviewPeriod, { skipConfirm: true });
    if (sent) closePayslipPreview();
  }

  function printPayroll() {
    if (!report) return;
    openPrintPreview({
      title: `Payroll · ${report.staffName} · ${report.monthLabel}`,
      sourceId: "staff-salary-print-root"
    });
  }

  const monthName = new Date(2000, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const computation = report ? buildStaffSalaryComputation(report) : [];
  const baseSplit = report ? splitBaseSalaryForSemiMonthly(report.baseSalary) : null;
  const monthlySection = computation.find((section) => section.title === "Monthly computation");
  const midSection = computation.find((section) => section.title === "Mid-month payment");
  const endSection = computation.find((section) => section.title === "End-of-month payment");
  const midRun = report?.payRuns.find((run) => run.period === "mid");
  const endRun = report?.payRuns.find((run) => run.period === "end");
  const formatPayRunAmount = useCallback(
    (row: StaffSalaryComputeRow) => formatComputeAmount(row),
    []
  );
  const midComputeRows = useMemo(
    () => payReleaseComputeRows(midSection, formatPayRunAmount),
    [midSection, formatPayRunAmount]
  );
  const endComputeRows = useMemo(
    () => payReleaseComputeRows(endSection, formatPayRunAmount),
    [endSection, formatPayRunAmount]
  );

  return (
    <div className="staff-salary staff-salary--printable">
      <header className="staff-salary__page-head no-print">
        <div>
          <p className="staff-salary__eyebrow">Internal payroll</p>
          <h2 className="staff-salary__title">Staff compensation</h2>
          <p className="staff-salary__lede">
            Formal payslip for semi-monthly release. Admin use only — not for client billing.
          </p>
        </div>
        {report ? (
          <div className="staff-salary__page-head-actions">
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--secondary"
              disabled={busy}
              onClick={printPayroll}
            >
              Print payroll
            </button>
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--secondary"
              disabled={busy}
              onClick={() => void copyStatement()}
            >
              Copy statement
            </button>
          </div>
        ) : null}
      </header>

      <FirmLawyersRosterPanel
        roster={lawyers}
        busy={busy || rosterLoading}
        onSaved={setLawyers}
        onStatus={onStatus}
      />

      <StaffPayrollRosterPanel
        roster={roster}
        busy={busy || rosterLoading}
        onSaved={(next) => {
          setRoster(next);
          setStaffId((current) => {
            if (current && next.some((entry) => entry.id === current)) return current;
            return next[0]?.id || "";
          });
        }}
        onStatus={onStatus}
      />

      <section className="staff-salary__panel staff-salary__panel--report">
        <div className="staff-salary__toolbar no-print">
          <div className="staff-salary__toolbar-copy">
            <p className="staff-salary__toolbar-label">Pay period</p>
            <p className="staff-salary__toolbar-period">
              {monthName} {year}
            </p>
            <p className="staff-salary__toolbar-hint">Use ← → to change month</p>
          </div>
          <div className="staff-salary__toolbar-actions">
            <select
              className="field firm-finances__select staff-salary__select staff-salary__select--staff"
              value={staffId}
              disabled={busy || reportLoading || rosterLoading || !roster.length}
              onChange={(e) => setStaffId(e.target.value)}
              aria-label="Staff member"
            >
              {!roster.length ? (
                <option value="">Add staff on the roster first</option>
              ) : (
                roster.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.displayName}
                  </option>
                ))
              )}
            </select>
            <select
              className="field firm-finances__select staff-salary__select"
              value={month}
              disabled={busy || reportLoading}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Month"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
            <select
              className="field firm-finances__select staff-salary__select staff-salary__select--year"
              value={year}
              disabled={busy || reportLoading}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--secondary staff-salary__refresh-btn"
              disabled={busy || reportLoading}
              onClick={() => void loadReport()}
            >
              {reportLoading ? "Reloading…" : "Reload"}
            </button>
          </div>
        </div>

        {reportError ? <p className="staff-salary__error">{reportError}</p> : null}

        {!staffId && !rosterLoading ? (
          <EmptyState
            title="No payroll staff selected"
            message="Add staff on the roster above, then choose a name to run payroll."
          />
        ) : null}

        {reportLoading && staffId ? (
          <div className="staff-salary__loading">
            <Skeleton className="h-[28rem] w-full rounded-sm" />
          </div>
        ) : null}

        {report && !reportLoading ? (
          <>
            <div className="staff-salary__admin no-print">
              <StaffSalarySetupBar
                baseSalary={baseSalary}
                onChange={setBaseSalary}
                onSave={() => void saveBaseSalary()}
                saving={savingBase}
                locked={report.midMonthPaid || report.endMonthPaid}
                busy={busy}
                midPaid={report.midMonthPaid}
                endPaid={report.endMonthPaid}
                grossTotal={report.grossTotal}
              />

              <div className="staff-salary__tools-workspace">
                <div className="staff-salary__tools-switcher">
                  <p className="staff-salary__tools-switcher-label">02 · Payroll tools</p>
                  <StaffSalaryToolTabs active={adminTab} onChange={setAdminTab} disabled={busy} />
                </div>

                <div className="staff-salary__tools-panel-wrap">
                  {adminTab === "overtime" ? (
                    <StaffSalaryToolPanel
                      eyebrow="Labor Code"
                      title="Overtime calculator"
                      lede={`Working days: ${otWorkingDays} (${laborCodeRestDayDivisorNote(otRestDays)}). ${laborCodeOvertimeFormulaText(otRestDays)}.`}
                    >
                      <div className="staff-salary__tool-block">
                        <p className="staff-salary__tool-block-label">Rest days</p>
                        <div className="staff-salary__tool-segment" role="tablist" aria-label="Rest days">
                          {STAFF_OVERTIME_REST_DAY_SCHEDULES.map((entry) => {
                            const active = otRestDays === entry.id;
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                className={`staff-salary__tool-segment-btn ${active ? "staff-salary__tool-segment-btn--active" : ""}`}
                                disabled={busy || postingOvertime || report.endMonthPaid}
                                onClick={() => setOtRestDays(entry.id)}
                              >
                                <span>{entry.label}</span>
                                <span className="staff-salary__tool-segment-meta">{entry.workingDays} days</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {report.baseSalary > 0 ? (
                        <StaffSalaryRateCards items={overtimeRateCards} />
                      ) : (
                        <p className="staff-salary__tool-note staff-salary__tool-note--warn">
                          Set a base salary above to compute overtime rates.
                        </p>
                      )}

                      <StaffSalaryFormGrid>
                    <StaffSalaryField label="OT date">
                      <input
                        className="field"
                        type="date"
                        value={otDate}
                        disabled={busy || postingOvertime || report.endMonthPaid}
                        onChange={(e) => setOtDate(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="OT hours">
                      <input
                        className="field"
                        type="number"
                        min={0}
                        step="0.25"
                        value={otHours}
                        disabled={busy || postingOvertime || report.endMonthPaid}
                        placeholder="2"
                        onChange={(e) => setOtHours(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Day type" wide>
                      <select
                        className="field firm-finances__select"
                        value={otDayType}
                        disabled={busy || postingOvertime || report.endMonthPaid}
                        onChange={(e) => setOtDayType(e.target.value as StaffOvertimeDayType)}
                      >
                        {STAFF_OVERTIME_DAY_TYPES.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label} (×{entry.multiplier})
                          </option>
                        ))}
                      </select>
                    </StaffSalaryField>
                    <label className="staff-salary__tool-check">
                      <input
                        type="checkbox"
                        checked={otNightShift}
                        disabled={busy || postingOvertime || report.endMonthPaid}
                        onChange={(e) => setOtNightShift(e.target.checked)}
                      />
                      <span>Night differential (+10% · 10 PM–6 AM)</span>
                    </label>
                  </StaffSalaryFormGrid>

                  {overtimePreview ? (
                    <>
                      <StaffSalaryComputeSheet rows={overtimeComputeRows} />
                      <StaffSalaryResultHero
                        label="Amount to post"
                        detail={`${overtimePreview.hours} hour${overtimePreview.hours === 1 ? "" : "s"} · ${overtimePreview.payPeriodLabel}`}
                        amount={formatPeso(overtimePreview.totalPay)}
                        meta={overtimePreview.restDayScheduleLabel + " rest · " + overtimePreview.dayTypeLabel}
                      />
                    </>
                  ) : report.baseSalary > 0 ? (
                    <EmptyState compact message="Enter OT hours to see the step-by-step computation." />
                  ) : null}

                  <StaffSalaryActions>
                    {editingOvertimeId ? (
                      <>
                        <button
                          type="button"
                          className="staff-salary__btn staff-salary__btn--primary"
                          disabled={busy || postingOvertime || !overtimePreview}
                          onClick={() => void saveEditOvertime()}
                        >
                          {postingOvertime ? "Saving…" : "Save overtime"}
                        </button>
                        <button
                          type="button"
                          className="staff-salary__btn staff-salary__btn--outline"
                          disabled={busy || postingOvertime}
                          onClick={cancelEditOvertime}
                        >
                          Cancel edit
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="staff-salary__btn staff-salary__btn--primary"
                        disabled={busy || postingOvertime || report.endMonthPaid || !overtimePreview}
                        onClick={() => void postOvertimeAdjustment()}
                      >
                        {postingOvertime ? "Posting…" : "Post overtime to payroll"}
                      </button>
                    )}
                  </StaffSalaryActions>

                  {overtimeAdjustments.length ? (
                    <div className="staff-salary__compute-sheet staff-salary__compute-sheet--tool staff-salary__compute-sheet--list">
                      <div className="staff-salary__compute-head" aria-hidden>
                        <span>Overtime posted</span>
                        <span>Amount (PHP)</span>
                      </div>
                      {overtimeAdjustments.map((entry) => (
                        <div key={entry.id} className="staff-salary__compute-row">
                          <div className="staff-salary__compute-copy">
                            <p className="staff-salary__compute-label">{entry.label}</p>
                            <p className="staff-salary__compute-detail">
                              {entry.date}
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                          </div>
                          <div className="staff-salary__compute-amount-wrap">
                            <p className="staff-salary__compute-amount amount-serif">{formatPeso(entry.amount)}</p>
                            <StaffSalaryEntryActions
                              disabled={busy || isPayrollLineLocked(report, entry)}
                              editing={editingOvertimeId === entry.id}
                              deleting={deletingOvertimeId === entry.id}
                              onEdit={() => startEditOvertime(entry)}
                              onDelete={() => void deleteOvertimeEntry(entry.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </StaffSalaryToolPanel>
              ) : null}

              {adminTab === "adjustments" ? (
                <StaffSalaryToolPanel
                  eyebrow="Payroll lines"
                  title="Manual adjustments"
                  lede="Bonuses, deductions, or other amounts — applied on the nearest payday (15th or last day)."
                >
                  <StaffSalaryFormGrid>
                    <StaffSalaryField label="Label">
                      <input
                        className="field"
                        value={adjustLabel}
                        disabled={busy || adjusting || report.endMonthPaid}
                        placeholder="Bonus · Deduction"
                        onChange={(e) => setAdjustLabel(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Amount">
                      <input
                        className="field"
                        type="number"
                        step="0.01"
                        value={adjustAmount}
                        disabled={busy || adjusting || report.endMonthPaid}
                        placeholder="-500 or 1000"
                        onChange={(e) => setAdjustAmount(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Date">
                      <input
                        className="field"
                        type="date"
                        value={adjustDate}
                        disabled={busy || adjusting || report.endMonthPaid}
                        onChange={(e) => setAdjustDate(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Note" wide>
                      <input
                        className="field"
                        value={adjustNote}
                        disabled={busy || adjusting || report.endMonthPaid}
                        placeholder="Optional note"
                        onChange={(e) => setAdjustNote(e.target.value)}
                      />
                    </StaffSalaryField>
                  </StaffSalaryFormGrid>

                  <StaffSalaryActions>
                    {editingAdjustmentId ? (
                      <>
                        <button
                          type="button"
                          className="staff-salary__btn staff-salary__btn--primary"
                          disabled={busy || adjusting}
                          onClick={() => void saveEditAdjustment()}
                        >
                          {adjusting ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          className="staff-salary__btn staff-salary__btn--outline"
                          disabled={busy || adjusting}
                          onClick={cancelEditAdjustment}
                        >
                          Cancel edit
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="staff-salary__btn staff-salary__btn--secondary"
                        disabled={busy || adjusting || report.endMonthPaid}
                        onClick={() => void submitAdjustment()}
                      >
                        {adjusting ? "Posting…" : "Post adjustment"}
                      </button>
                    )}
                  </StaffSalaryActions>

                  {manualAdjustments.length ? (
                    <div className="staff-salary__compute-sheet staff-salary__compute-sheet--tool staff-salary__compute-sheet--list">
                      <div className="staff-salary__compute-head" aria-hidden>
                        <span>Adjustment</span>
                        <span>Amount (PHP)</span>
                      </div>
                      {manualAdjustments.map((entry) => (
                        <div
                          key={entry.id}
                          className={`staff-salary__compute-row ${entry.amount < 0 ? "staff-salary__compute-row--deduct" : ""}`}
                        >
                          <div className="staff-salary__compute-copy">
                            <p className="staff-salary__compute-label">{entry.label}</p>
                            <p className="staff-salary__compute-detail">
                              {entry.date}
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                          </div>
                          <div className="staff-salary__compute-amount-wrap">
                            <p
                              className={`staff-salary__compute-amount amount-serif ${entry.amount < 0 ? "staff-salary__compute-amount--deduct" : ""}`}
                            >
                              {entry.amount < 0 ? `−${formatPeso(Math.abs(entry.amount))}` : formatPeso(entry.amount)}
                            </p>
                            <StaffSalaryEntryActions
                              disabled={busy || isPayrollLineLocked(report, entry)}
                              editing={editingAdjustmentId === entry.id}
                              deleting={deletingAdjustmentId === entry.id}
                              onEdit={() => startEditAdjustment(entry)}
                              onDelete={() => void deleteAdjustmentEntry(entry.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState compact message="No manual adjustments this month." />
                  )}
                </StaffSalaryToolPanel>
              ) : null}

              {adminTab === "cashAdvances" ? (
                <StaffSalaryToolPanel
                  eyebrow="Staff loans"
                  title="Cash advances"
                  lede="Record an advance and HA Office will deduct equal installments on each payday — 2 months = 4 paychecks, 3 months = 6 paychecks, starting on the next pay run after the advance date."
                >
                  <StaffSalaryFormGrid>
                    <StaffSalaryField label="Amount given">
                      <input
                        className="field"
                        type="number"
                        step="0.01"
                        min="0"
                        value={caAmount}
                        disabled={busy || caRecording}
                        placeholder="5000"
                        onChange={(e) => setCaAmount(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Date given">
                      <input
                        className="field"
                        type="date"
                        value={caDate}
                        disabled={busy || caRecording}
                        onChange={(e) => setCaDate(e.target.value)}
                      />
                    </StaffSalaryField>
                    <StaffSalaryField label="Repayment term">
                      <select
                        className="field"
                        value={caTermMonths}
                        disabled={busy || caRecording}
                        onChange={(e) => setCaTermMonths(Number(e.target.value) === 3 ? 3 : 2)}
                      >
                        <option value={2}>2 months · 4 paychecks</option>
                        <option value={3}>3 months · 6 paychecks</option>
                      </select>
                    </StaffSalaryField>
                    <StaffSalaryField label="Note" wide>
                      <input
                        className="field"
                        value={caNote}
                        disabled={busy || caRecording}
                        placeholder="Optional reason"
                        onChange={(e) => setCaNote(e.target.value)}
                      />
                    </StaffSalaryField>
                  </StaffSalaryFormGrid>

                  <StaffSalaryActions>
                    <button
                      type="button"
                      className="staff-salary__btn staff-salary__btn--primary"
                      disabled={busy || caRecording}
                      onClick={() => void submitCashAdvance()}
                    >
                      {caRecording
                        ? "Saving…"
                        : editingCashAdvanceId
                          ? "Save cash advance"
                          : "Record cash advance"}
                    </button>
                    {editingCashAdvanceId ? (
                      <button
                        type="button"
                        className="staff-salary__btn staff-salary__btn--outline"
                        disabled={busy || caRecording}
                        onClick={cancelEditCashAdvance}
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </StaffSalaryActions>

                  {report.cashAdvances?.length ? (
                    <div className="staff-salary__compute-sheet staff-salary__compute-sheet--tool staff-salary__compute-sheet--list">
                      <div className="staff-salary__compute-head" aria-hidden>
                        <span>Advance</span>
                        <span>Balance</span>
                      </div>
                      {report.cashAdvances.map((advance) => {
                        const remaining = cashAdvanceRemainingBalance(advance);
                        const paidCount = advance.installments.filter((item) => item.paidAt).length;
                        return (
                          <div key={advance.id} className="staff-salary__compute-row">
                            <div className="staff-salary__compute-copy">
                              <p className="staff-salary__compute-label">
                                {formatPeso(advance.amount)} · {formatCashAdvanceScheduleLabel(advance)}
                              </p>
                              <p className="staff-salary__compute-detail">
                                {advance.date}
                                {advance.note ? ` · ${advance.note}` : ""}
                                {" · "}
                                {advance.status === "paid"
                                  ? "Fully repaid"
                                  : advance.status === "cancelled"
                                    ? "Cancelled"
                                    : `${paidCount}/${advance.installments.length} paid`}
                              </p>
                              {advance.status === "active" ? (
                                <p className="staff-salary__compute-detail">
                                  Next deductions appear automatically on mid-month and end-of-month pay.
                                </p>
                              ) : null}
                            </div>
                            <div className="staff-salary__compute-amount-wrap">
                              <p
                                className={`staff-salary__compute-amount amount-serif ${remaining > 0 ? "staff-salary__compute-amount--deduct" : ""}`}
                              >
                                {remaining > 0 ? formatPeso(remaining) : "—"}
                              </p>
                              {advance.status === "active" && paidCount === 0 ? (
                                <StaffSalaryEntryActions
                                  disabled={busy}
                                  editing={editingCashAdvanceId === advance.id}
                                  deleting={caCancellingId === advance.id}
                                  deleteLabel="Delete"
                                  onEdit={() => startEditCashAdvance(advance)}
                                  onDelete={() => void cancelCashAdvance(advance.id)}
                                />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState compact message="No cash advances on file for this staff member." />
                  )}
                </StaffSalaryToolPanel>
              ) : null}

              {adminTab === "13th" ? (
                <Staff13thMonthPanel
                  embedded
                  staffId={staffId}
                  year={year}
                  busy={busy}
                  onStatus={onStatus}
                  onPayrollChanged={() => void loadReport()}
                />
              ) : null}

                </div>
              </div>
            </div>

            <div className="staff-salary__statement-head no-print">
              <p className="staff-salary__statement-label">03 · Payroll statement</p>
              <p className="staff-salary__statement-hint">
                Live preview and print layout · updates when you save base salary or post payroll lines above
              </p>
            </div>

            <div className="staff-salary__slip-wrap" id="staff-salary-print-root">
              <article className="staff-salary__slip" aria-label="Payroll statement">
                <div className="staff-salary__slip-rule" aria-hidden />

                <header className="staff-salary__slip-masthead">
                  <div className="staff-salary__slip-brand">
                    <div className="firm-print-letterhead__logo-wrap">
                      <img
                        src={firmLogoPublicUrl()}
                        alt=""
                        className="firm-print-letterhead__logo"
                        width={64}
                        height={64}
                      />
                    </div>
                    <div className="firm-print-letterhead__identity staff-salary__slip-identity">
                      <p className="staff-salary__slip-firm-name font-display">{FIRM_NAME}</p>
                      <p className="staff-salary__slip-firm-tag">{FIRM_SUBTITLE}</p>
                      <p className="staff-salary__slip-firm-address">{FIRM_ADDRESS}</p>
                    </div>
                  </div>
                  <div className="staff-salary__slip-doc">
                    <p className="staff-salary__slip-doc-type">Payroll statement</p>
                    <p className="staff-salary__slip-doc-ref">{payslipReference(report)}</p>
                  </div>
                </header>

                <div className="staff-salary__slip-employee">
                  <div className="staff-salary__slip-employee-main">
                    <p className="staff-salary__slip-employee-label">Employee</p>
                    <h3 className="staff-salary__slip-employee-name font-display">{report.staffName}</h3>
                    <p className="staff-salary__slip-employee-role">{report.role}</p>
                    <p className="staff-salary__slip-employee-payroll">
                      {formatStaffPayrollAccount(report)}
                    </p>
                  </div>
                  <div className="staff-salary__slip-employee-rate">
                    <p className="staff-salary__slip-employee-label">Monthly base salary</p>
                    <p className="staff-salary__slip-employee-salary amount-serif">{formatPeso(report.baseSalary)}</p>
                    {baseSplit ? (
                      <p className="staff-salary__slip-employee-rate-hint">
                        Semi-monthly · {formatPeso(baseSplit.mid)} + {formatPeso(baseSplit.end)} base
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="staff-salary__slip-meta">
                  <dl className="staff-salary__slip-field">
                    <dt>Pay period</dt>
                    <dd>{report.monthLabel}</dd>
                  </dl>
                  <dl className="staff-salary__slip-field">
                    <dt>Pay frequency</dt>
                    <dd>Semi-monthly · 15th &amp; last day</dd>
                  </dl>
                  <dl className="staff-salary__slip-field">
                    <dt>Monthly allowance</dt>
                    <dd>{formatPeso(report.monthlyAllowance)} · end-of-month pay</dd>
                  </dl>
                  <dl className="staff-salary__slip-field">
                    <dt>Payroll account</dt>
                    <dd className="staff-salary__slip-account">{formatStaffPayrollAccount(report)}</dd>
                  </dl>
                  <dl className="staff-salary__slip-field">
                    <dt>Reference</dt>
                    <dd>{payslipReference(report)}</dd>
                  </dl>
                </div>

                <div className="staff-salary__slip-status-row">
                  <span
                    className={`staff-salary__slip-status ${report.midMonthPaid ? "staff-salary__slip-status--released" : "staff-salary__slip-status--pending"}`}
                  >
                    Mid-month · {report.midMonthPaid ? "Released" : "Pending"}
                  </span>
                  <span
                    className={`staff-salary__slip-status ${report.endMonthPaid ? "staff-salary__slip-status--released" : "staff-salary__slip-status--pending"}`}
                  >
                    End-month · {report.endMonthPaid ? "Released" : "Pending"}
                  </span>
                </div>

                {monthlySection ? (
                  <section className="staff-salary__slip-section">
                    <h3 className="staff-salary__slip-section-title">Earnings &amp; adjustments</h3>
                    <div className="staff-salary__compute-sheet">
                      <div className="staff-salary__compute-head" aria-hidden>
                        <span>Particulars</span>
                        <span>Amount (PHP)</span>
                      </div>
                      {monthlySection.rows
                        .filter((row) => row.tone !== "total")
                        .map((row, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className={`staff-salary__compute-row ${row.tone === "subtotal" ? "staff-salary__compute-row--subtotal" : row.tone === "deduct" ? "staff-salary__compute-row--deduct" : row.tone === "muted" ? "staff-salary__compute-row--muted" : ""}`}
                        >
                          <div className="staff-salary__compute-copy">
                            <p className="staff-salary__compute-label">{row.label}</p>
                            {row.detail ? <p className="staff-salary__compute-detail">{row.detail}</p> : null}
                          </div>
                          <p className={computeRowClass(row)}>{formatComputeAmount(row)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className="staff-salary__slip-net">
                  <div className="staff-salary__slip-net-copy">
                    <p className="staff-salary__slip-net-label">Total monthly compensation</p>
                    <p className="staff-salary__slip-net-hint">Gross earnings for {report.monthLabel}</p>
                  </div>
                  <p className="staff-salary__slip-net-value amount-serif amount-serif--hero">
                    {formatPeso(report.grossTotal)}
                  </p>
                </div>

                <section className="staff-salary__slip-section">
                  <h3 className="staff-salary__slip-section-title">Payment release</h3>
                  <p className="staff-salary__slip-section-desc">
                    Semi-monthly amounts due · weekend pay dates move to the prior business day
                  </p>
                  <div className="staff-salary__voucher-grid">
                    {midRun ? (
                      <StaffSalaryPayReleaseCard
                        run={midRun}
                        columnLabel="15th"
                        columnHint="First release · mid-month"
                        computeRows={midComputeRows}
                        report={report}
                        busy={busy}
                        closingPeriod={closingPeriod}
                        reopeningPeriod={reopeningPeriod}
                        transferringPeriod={transferringPeriod}
                        transferRef={transferRefByPeriod.mid}
                        onTransferRefChange={(value) =>
                          setTransferRefByPeriod((prev) => ({ ...prev, mid: value }))
                        }
                        onCopyTransferMemo={() => void copyTransferMemo("mid")}
                        onMarkTransferred={() => void markTransferred("mid")}
                        onReopen={() => void reopenPayRun("mid")}
                        onMarkPaid={() => void markPaid("mid")}
                        onPreviewPayslip={() => void previewPayslip("mid")}
                        onEmailPayslip={() => void emailPayslip("mid")}
                        previewingPeriod={previewingPeriod === "mid"}
                        emailingPeriod={emailingPeriod === "mid"}
                      />
                    ) : null}
                    {endRun ? (
                      <StaffSalaryPayReleaseCard
                        run={endRun}
                        columnLabel="Last day"
                        columnHint="Second release · allowance included"
                        computeRows={endComputeRows}
                        report={report}
                        busy={busy}
                        closingPeriod={closingPeriod}
                        reopeningPeriod={reopeningPeriod}
                        transferringPeriod={transferringPeriod}
                        transferRef={transferRefByPeriod.end}
                        onTransferRefChange={(value) =>
                          setTransferRefByPeriod((prev) => ({ ...prev, end: value }))
                        }
                        onCopyTransferMemo={() => void copyTransferMemo("end")}
                        onMarkTransferred={() => void markTransferred("end")}
                        onReopen={() => void reopenPayRun("end")}
                        onMarkPaid={() => void markPaid("end")}
                        onPreviewPayslip={() => void previewPayslip("end")}
                        onEmailPayslip={() => void emailPayslip("end")}
                        previewingPeriod={previewingPeriod === "end"}
                        emailingPeriod={emailingPeriod === "end"}
                      />
                    ) : null}
                  </div>
                </section>

                {report.includesFieldDispatch && report.fieldDispatch.length ? (
                  <section className="staff-salary__slip-section staff-salary__schedule-b">
                    <p className="staff-salary__schedule-b-eyebrow">Payroll annex</p>
                    <h3 className="staff-salary__slip-section-title">Schedule B · Field dispatch credits</h3>
                    <p className="staff-salary__slip-section-desc">
                      Service fee minus change returned. Each trip posts to the nearest payday (15th or last day).
                    </p>

                    <div className="staff-salary__annex-ledger-wrap">
                      <table className="staff-salary__annex-ledger">
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Pay run</th>
                            <th scope="col">Trip</th>
                            <th scope="col">Computation</th>
                            <th scope="col" className="staff-salary__annex-ledger-amount">
                              Payroll
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.fieldDispatch.map((trip) => (
                            <tr
                              key={trip.dispatchId}
                              className={trip.staffSalaryPaid ? "staff-salary__annex-ledger-row--paid" : ""}
                            >
                              <td className="staff-salary__annex-ledger-date">{trip.date}</td>
                              <td>
                                <span
                                  className={`staff-salary__annex-pay-run staff-salary__annex-pay-run--${trip.payPeriod}`}
                                >
                                  {trip.payPeriod === "mid" ? "15th" : "Last day"}
                                </span>
                              </td>
                              <td>
                                <span className="staff-salary__annex-trip">{trip.location}</span>
                                <span className="staff-salary__annex-sub">
                                  {trip.purpose}
                                  {trip.clientCode ? (
                                    <>
                                      {" · "}
                                      <MatterLink code={trip.clientCode} className="staff-salary__dispatch-link">
                                        {trip.clientCode}
                                      </MatterLink>
                                    </>
                                  ) : null}
                                </span>
                              </td>
                              <td className="staff-salary__annex-formula">
                                <span className="staff-salary__annex-formula-line">
                                  {formatPeso(trip.serviceFee)}
                                  <span className="staff-salary__annex-formula-op" aria-hidden>
                                    {" "}
                                    −{" "}
                                  </span>
                                  {formatPeso(trip.returnedToOffice)}
                                </span>
                                <span className="staff-salary__annex-formula-eq">
                                  = <strong className="amount-serif">{formatPeso(trip.salaryCredit)}</strong>
                                </span>
                              </td>
                              <td className="staff-salary__annex-ledger-amount">
                                <span className="staff-salary__annex-ledger-pay amount-serif">
                                  {trip.staffSalaryPaid ? formatPeso(0) : formatPeso(trip.salaryDue)}
                                </span>
                                <span
                                  className={`staff-salary__annex-badge ${trip.staffSalaryPaid ? "staff-salary__annex-badge--paid" : ""}`}
                                >
                                  {trip.staffSalaryPaid ? "Paid early" : "On payroll"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="staff-salary__annex-ledger-foot staff-salary__annex-ledger-foot--sub">
                            <td colSpan={4}>Total field dispatch credits</td>
                            <td className="staff-salary__annex-ledger-amount amount-serif">
                              {formatPeso(report.totalFieldDispatchSalary)}
                            </td>
                          </tr>
                          {report.totalFieldDispatchPaidEarly > 0 ? (
                            <tr className="staff-salary__annex-ledger-foot staff-salary__annex-ledger-foot--deduct">
                              <td colSpan={4}>Less · paid early from dispatch register</td>
                              <td className="staff-salary__annex-ledger-amount amount-serif">
                                −{formatPeso(report.totalFieldDispatchPaidEarly)}
                              </td>
                            </tr>
                          ) : null}
                          <tr className="staff-salary__annex-ledger-foot staff-salary__annex-ledger-foot--total">
                            <td colSpan={4}>Due on payroll</td>
                            <td className="staff-salary__annex-ledger-amount amount-serif">
                              {formatPeso(report.totalFieldDispatchDue)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                ) : null}

                <footer className="staff-salary__slip-footer">
                  <p>Confidential · For internal payroll and accounting use only.</p>
                  <p>Hernandez &amp; Associates · Payroll · {report.monthLabel}</p>
                </footer>
              </article>
            </div>
          </>
        ) : null}
      </section>

      <StaffPayslipEmailPreviewDialog
        open={Boolean(payslipPreviewPeriod)}
        loading={payslipPreviewLoading}
        error={payslipPreviewError}
        preview={payslipPreview}
        sending={Boolean(emailingPeriod)}
        onClose={closePayslipPreview}
        onSend={() => void sendPayslipFromPreview()}
      />
    </div>
  );
}
