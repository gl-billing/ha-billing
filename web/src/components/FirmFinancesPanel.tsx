"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALLOCATION_BUCKET_LABELS,
  ALLOCATION_BUCKET_ORDER,
  DEFAULT_ALLOCATION_PERCENTS,
  UNASSIGNED_ATTORNEY_LABEL,
  formatMonthlyStatementText,
  formatAppearanceFeeStatementText,
  monthCloseHasBlockers,
  monthCloseHasWarnings,
  type AllocationBucketKey,
  type AllocationSettings,
  type AppearanceFeeAttorneySummary,
  type MonthlyAllocationReport,
  type UnclassifiedIncomeLine
} from "@/lib/firm-allocation";
import { ACCEPTANCE_FEE_SHARE_PERCENTS, MANAGING_PARTNER, PLEADING_FEE_SHARE_PERCENTS } from "@/lib/firm-team-config";
import {
  acceptanceFeeSharingSummary,
  appearanceFeeSharingSummary,
  pleadingFeeSharingSummary
} from "@/lib/firm-fee-sharing-labels";
import { lawyerFeeShareAmount } from "@/lib/firm-lawyers-roster";
import type { FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";
import type { StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";
import { formatPeso } from "@/lib/gl-config";
import { matterHref } from "@/lib/matter-routes";
import {
  PAYMENT_INCOME_TYPES,
  buildPaymentLedgerFields,
  type PaymentIncomeType
} from "@/lib/payment-income";
import { MetricSkeleton, Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";

type Props = {
  busy: boolean;
  onStatus: (message: string, isError?: boolean) => void;
};

const BUCKET_SHORT: Record<AllocationBucketKey, string> = {
  expenses: "Expenses",
  savings: "Savings",
  travel: "Travel",
  emergency: "Reserve"
};

function attorneyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function sourceLabel(line: MonthlyAllocationReport["lines"][number]): string {
  if (line.source === "notarization") return "Notarial";
  const text = line.label.toLowerCase();
  if (text.includes("acceptance")) return "Acceptance";
  if (text.includes("professional")) return "Professional";
  if (text.includes("notarial") || text.includes("notarization")) return "Notarial";
  return "Office";
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function FirmFinancesPanel({ busy, onStatus }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyAllocationReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expensesPct, setExpensesPct] = useState(String(DEFAULT_ALLOCATION_PERCENTS.expenses));
  const [savingsPct, setSavingsPct] = useState(String(DEFAULT_ALLOCATION_PERCENTS.savings));
  const [travelPct, setTravelPct] = useState(String(DEFAULT_ALLOCATION_PERCENTS.travel));
  const [emergencyPct, setEmergencyPct] = useState(String(DEFAULT_ALLOCATION_PERCENTS.emergency));
  const [openingExpenses, setOpeningExpenses] = useState("0");
  const [openingSavings, setOpeningSavings] = useState("0");
  const [openingTravel, setOpeningTravel] = useState("0");
  const [openingEmergency, setOpeningEmergency] = useState("0");
  const [settingsMeta, setSettingsMeta] = useState<AllocationSettings | null>(null);
  const [reclassifyBusyId, setReclassifyBusyId] = useState("");
  const [reopeningMonth, setReopeningMonth] = useState(false);
  const [adjustBucket, setAdjustBucket] = useState<AllocationBucketKey>("expenses");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustingBucket, setAdjustingBucket] = useState(false);
  const [lawyers, setLawyers] = useState<FirmLawyerRosterEntry[]>([]);
  const [payrollStaff, setPayrollStaff] = useState<StaffPayrollRosterEntry[]>([]);

  const livePercents = useMemo(
    () => ({
      expenses: Number(expensesPct) || 0,
      savings: Number(savingsPct) || 0,
      travel: Number(travelPct) || 0,
      emergency: Number(emergencyPct) || 0
    }),
    [expensesPct, savingsPct, travelPct, emergencyPct]
  );

  const percentTotal =
    Math.round(
      (livePercents.expenses + livePercents.savings + livePercents.travel + livePercents.emergency) * 100
    ) / 100;
  const percentValid = Math.abs(percentTotal - 100) < 0.01;

  function applySettings(settings: AllocationSettings) {
    setSettingsMeta(settings);
    setExpensesPct(String(settings.percents.expenses));
    setSavingsPct(String(settings.percents.savings));
    setTravelPct(String(settings.percents.travel));
    setEmergencyPct(String(settings.percents.emergency));
  }

  function applyBucketOpening(reportData: MonthlyAllocationReport) {
    setOpeningExpenses(String(reportData.bucketBalances.opening.expenses));
    setOpeningSavings(String(reportData.bucketBalances.opening.savings));
    setOpeningTravel(String(reportData.bucketBalances.opening.travel));
    setOpeningEmergency(String(reportData.bucketBalances.opening.emergency));
  }

  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    void fetch("/api/firm-finances/settings")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.settings) applySettings(json.settings as AllocationSettings);
      })
      .catch(() => {
        if (!cancelled) onStatus("Could not load allocation settings.", true);
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onStatus]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetch("/api/firm-lawyers/roster"), fetch("/api/staff-salary/roster")])
      .then(async ([lawyersRes, staffRes]) => {
        const lawyersJson = await lawyersRes.json();
        const staffJson = await staffRes.json();
        if (cancelled) return;
        if (lawyersRes.ok) setLawyers((lawyersJson.roster || []) as FirmLawyerRosterEntry[]);
        if (staffRes.ok) setPayrollStaff((staffJson.roster || []) as StaffPayrollRosterEntry[]);
      })
      .catch(() => {
        /* optional team roster for fee-share context */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function lawyerSharePercent(attorneyName: string): number {
    const match = lawyers.find(
      (lawyer) => lawyer.displayName.trim().toLowerCase() === attorneyName.trim().toLowerCase()
    );
    return match?.feeSharePercent ?? 100;
  }

  function attorneyShareLine(group: AppearanceFeeAttorneySummary): string {
    const pct = lawyerSharePercent(group.assignedAttorney);
    const share = lawyerFeeShareAmount(group.total, pct);
    return `${pct}% share · ${formatPeso(share)}`;
  }

  const staffByLawyer = useMemo(() => {
    const map = new Map<string, StaffPayrollRosterEntry[]>();
    for (const staff of payrollStaff) {
      const key = staff.associatedLawyerName.trim() || "Unassigned";
      const bucket = map.get(key) || [];
      bucket.push(staff);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [payrollStaff]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError("");
    try {
      const res = await fetch(`/api/firm-finances/split?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load income split.");
      const nextReport = json as MonthlyAllocationReport;
      setReport(nextReport);
      if (json.settings) applySettings(json.settings as AllocationSettings);
      applyBucketOpening(nextReport);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load income split.";
      setReportError(msg);
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

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

  async function saveSettings() {
    if (!percentValid) {
      onStatus(`Percentages must add up to 100% (currently ${percentTotal}%).`, true);
      return;
    }
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/firm-finances/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expensesPct: Number(expensesPct),
          savingsPct: Number(savingsPct),
          travelPct: Number(travelPct),
          emergencyPct: Number(emergencyPct),
          bucketOpening: {
            expenses: Number(openingExpenses),
            savings: Number(openingSavings),
            travel: Number(openingTravel),
            emergency: Number(openingEmergency)
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save settings.");
      if (json.settings) applySettings(json.settings as AllocationSettings);
      onStatus(json.message || "Treasury settings saved.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save settings.", true);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function closeMonth(force = false) {
    if (!report || report.monthClosed) return;
    if (monthCloseHasBlockers(report.closeChecklist)) {
      onStatus("Fix allocation policy (must total 100%) before closing.", true);
      return;
    }
    if (!force && monthCloseHasWarnings(report.closeChecklist)) {
      onStatus("Resolve checklist warnings or use Close anyway.", true);
      return;
    }
    const msg = force
      ? `Close ${report.monthLabel} despite checklist warnings? Bucket balances will roll forward.`
      : `Mark ${report.monthLabel} as closed? This adds the month's bucket splits to your running balances.`;
    if (!window.confirm(msg)) return;

    setClosingMonth(true);
    try {
      const res = await fetch("/api/firm-finances/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, force })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not close month.");
      setReport(json.report as MonthlyAllocationReport);
      onStatus(json.message || "Month closed.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not close month.", true);
    } finally {
      setClosingMonth(false);
    }
  }

  async function reopenMonth() {
    if (!report?.monthClosed) return;
    if (
      !window.confirm(
        `Reopen ${report.monthLabel}? You can relabel payments again. Bucket balances will not be reversed.`
      )
    ) {
      return;
    }
    setReopeningMonth(true);
    try {
      const res = await fetch("/api/firm-finances/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reopen month.");
      setReport(json.report as MonthlyAllocationReport);
      onStatus(json.message || "Month reopened.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not reopen month.", true);
    } finally {
      setReopeningMonth(false);
    }
  }

  async function submitBucketAdjustment() {
    const amount = Number(adjustAmount);
    if (!adjustNote.trim()) {
      onStatus("Enter a note for this withdrawal or adjustment.", true);
      return;
    }
    if (!amount) {
      onStatus("Enter a non-zero amount (negative for withdrawal).", true);
      return;
    }
    setAdjustingBucket(true);
    try {
      const res = await fetch("/api/firm-finances/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: adjustBucket, amount, note: adjustNote.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record adjustment.");
      setAdjustAmount("");
      setAdjustNote("");
      onStatus(json.message || "Bucket adjustment recorded.");
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record adjustment.", true);
    } finally {
      setAdjustingBucket(false);
    }
  }

  async function copyStatement() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatMonthlyStatementText(report));
      onStatus("Statement copied to clipboard.");
    } catch {
      onStatus("Could not copy statement.", true);
    }
  }

  async function copyAppearanceStatement(group: MonthlyAllocationReport["appearanceFeeByAttorney"][number]) {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatAppearanceFeeStatementText(group, report.monthLabel));
      onStatus(`Appearance statement copied for ${group.assignedAttorney}.`);
    } catch {
      onStatus("Could not copy appearance statement.", true);
    }
  }

  async function reclassifyPayment(line: UnclassifiedIncomeLine, incomeType: PaymentIncomeType) {
    setReclassifyBusyId(line.id);
    try {
      const fields = buildPaymentLedgerFields(incomeType, line.label);
      const res = await fetch("/api/ledger", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: line.clientCode,
          sheetRow: line.sheetRow,
          category: fields.category,
          description: fields.description,
          reclassifyIncome: true
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reclassify payment.");
      onStatus(`Reclassified ${line.clientCode} as ${fields.category}.`);
      await loadReport();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not reclassify payment.", true);
    } finally {
      setReclassifyBusyId("");
    }
  }

  const monthName = new Date(2000, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const closeBlockers = report ? monthCloseHasBlockers(report.closeChecklist) : false;
  const closeWarnings = report ? monthCloseHasWarnings(report.closeChecklist) : false;
  const unassignedAppearance = report?.appearanceFeeByAttorney.find(
    (group) => group.assignedAttorney === UNASSIGNED_ATTORNEY_LABEL
  );
  const unassignedAcceptance = report?.acceptanceFeeSharing.byAssociate.find(
    (group) => group.associateName === UNASSIGNED_ATTORNEY_LABEL
  );

  return (
    <div className="firm-finances firm-finances--printable">
      <header className="firm-finances__hero">
        <div className="firm-finances__hero-copy">
          <p className="firm-finances__eyebrow">Partner treasury</p>
          <h2 className="firm-finances__title">Income allocation</h2>
          <p className="firm-finances__lede">
            Professional and notarial receipts, plus the firm share of acceptance fees, flow into office buckets.
            Acceptance fees: {acceptanceFeeSharingSummary()}. Drafting pleading fees: {pleadingFeeSharingSummary()}
            . Appearance fees: {appearanceFeeSharingSummary()} when payment is recorded on the client ledger.
          </p>
        </div>
        <div className="firm-finances__hero-meta">
          <span className="firm-finances__pill">Admin only</span>
          {report?.monthClosed ? (
            <span className="firm-finances__pill firm-finances__pill--closed">Month closed</span>
          ) : (
            <span className="firm-finances__pill firm-finances__pill--muted">Open period</span>
          )}
        </div>
      </header>

      <section className="firm-finances__panel">
        <button
          type="button"
          className="firm-finances__panel-toggle"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <span>
            <span className="firm-finances__panel-toggle-label">Allocation policy & opening balances</span>
            <span className="firm-finances__panel-toggle-hint">60 · 10 · 20 · 10 default</span>
          </span>
          <span className="firm-finances__panel-toggle-icon" aria-hidden>
            {settingsOpen ? "−" : "+"}
          </span>
        </button>

        {settingsOpen ? (
          <div className="firm-finances__settings-body">
            {settingsLoading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : (
              <>
                <div className="firm-finances__allocation-bar" aria-hidden>
                  {ALLOCATION_BUCKET_ORDER.map((key) => (
                    <span
                      key={key}
                      className={`firm-finances__allocation-segment firm-finances__allocation-segment--${key}`}
                      style={{ width: `${Math.max(0, livePercents[key])}%` }}
                      title={`${ALLOCATION_BUCKET_LABELS[key]} ${livePercents[key]}%`}
                    />
                  ))}
                </div>

                <div className="firm-finances__percent-grid">
                  {ALLOCATION_BUCKET_ORDER.map((key) => {
                    const valueMap = {
                      expenses: expensesPct,
                      savings: savingsPct,
                      travel: travelPct,
                      emergency: emergencyPct
                    };
                    const setMap = {
                      expenses: setExpensesPct,
                      savings: setSavingsPct,
                      travel: setTravelPct,
                      emergency: setEmergencyPct
                    };
                    return (
                      <label key={key} className={`firm-finances__percent-field firm-finances__percent-field--${key}`}>
                        <span className="firm-finances__percent-name">{ALLOCATION_BUCKET_LABELS[key]}</span>
                        <div className="firm-finances__percent-input">
                          <input
                            className="field firm-finances__percent-control"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            disabled={busy || settingsSaving}
                            value={valueMap[key]}
                            onChange={(e) => setMap[key](e.target.value)}
                          />
                          <span className="firm-finances__percent-suffix">%</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <p className="firm-finances__settings-subhead">Opening bucket balances</p>
                <div className="firm-finances__opening-grid">
                  {ALLOCATION_BUCKET_ORDER.map((key) => {
                    const valueMap = {
                      expenses: openingExpenses,
                      savings: openingSavings,
                      travel: openingTravel,
                      emergency: openingEmergency
                    };
                    const setMap = {
                      expenses: setOpeningExpenses,
                      savings: setOpeningSavings,
                      travel: setOpeningTravel,
                      emergency: setOpeningEmergency
                    };
                    return (
                      <label key={key} className={`firm-finances__opening-field firm-finances__opening-field--${key}`}>
                        <span className="firm-finances__percent-name">{BUCKET_SHORT[key]}</span>
                        <input
                          className="field firm-finances__percent-control"
                          type="number"
                          min={0}
                          step={0.01}
                          disabled={busy || settingsSaving}
                          value={valueMap[key]}
                          onChange={(e) => setMap[key](e.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="firm-finances__settings-footer">
                  <p className={`firm-finances__total ${percentValid ? "is-valid" : "is-invalid"}`}>
                    Total allocation · {percentTotal}%
                    {!percentValid ? " · must equal 100%" : ""}
                  </p>
                  <button
                    type="button"
                    className="btn-gold firm-finances__save-btn"
                    disabled={busy || settingsSaving || !percentValid}
                    onClick={() => void saveSettings()}
                  >
                    {settingsSaving ? "Saving…" : "Save treasury settings"}
                  </button>
                </div>

                {settingsMeta && !settingsMeta.percentValid ? (
                  <p className="firm-finances__settings-warning">
                    Saved policy totals {settingsMeta.percentTotal}%. Adjust and save to restore valid splits.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="firm-finances__panel firm-finances__panel--report">
        <div className="firm-finances__toolbar">
          <div>
            <p className="firm-finances__toolbar-label">Statement period</p>
            <p className="firm-finances__toolbar-period">
              {monthName} {year}
            </p>
            <p className="firm-finances__toolbar-hint">Use ← → to change month</p>
          </div>
          <div className="firm-finances__toolbar-actions">
            <select
              className="field firm-finances__select"
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
              className="field firm-finances__select firm-finances__select--year"
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
              className="btn-secondary firm-finances__refresh-btn"
              disabled={busy || reportLoading}
              onClick={() => void loadReport()}
            >
              {reportLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {reportError ? <p className="firm-finances__error">{reportError}</p> : null}

        {reportLoading ? (
          <div className="firm-finances__loading-grid">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="firm-finances__bucket-grid">
              {ALLOCATION_BUCKET_ORDER.map((key) => (
                <MetricSkeleton key={key} />
              ))}
            </div>
          </div>
        ) : null}

        {report && !reportLoading ? (
          <div className="firm-finances__report-inner">
            <div className="firm-finances__trend-strip no-print">
              {report.rollingMonths.map((entry) => (
                <button
                  key={`${entry.year}-${entry.month}`}
                  type="button"
                  className={`firm-finances__trend-chip ${
                    entry.year === year && entry.month === month ? "is-active" : ""
                  } ${entry.monthClosed ? "is-closed" : ""}`}
                  onClick={() => {
                    setYear(entry.year);
                    setMonth(entry.month);
                  }}
                >
                  <span className="firm-finances__trend-label">{entry.shortLabel}</span>
                  <span className="firm-finances__trend-value amount-serif">{formatPeso(entry.totalIncome)}</span>
                </button>
              ))}
              {report.priorYearChangePct !== undefined ? (
                <span className="firm-finances__yoy-chip">
                  YoY {report.priorYearChangePct >= 0 ? "+" : ""}
                  {report.priorYearChangePct}%
                </span>
              ) : null}
            </div>

            {report.incomeChangePct !== undefined ? (
              <p className="firm-finances__delta">
                {report.incomeChangePct >= 0 ? "+" : ""}
                {report.incomeChangePct}% vs prior month
              </p>
            ) : null}

            <div className="firm-finances__close-bar no-print">
              <div>
                <p className="firm-finances__close-title">Month-end ceremony</p>
                <p className="firm-finances__close-desc">
                  Review the checklist, copy a partner statement, then close the month to roll balances forward.
                </p>
                {report.monthClosed ? (
                  <p className="firm-finances__closed-note">
                    Closed{report.closedAt ? ` · ${report.closedAt}` : ""}. Reopen to relabel payments in this
                    period.
                  </p>
                ) : null}
              </div>
              <ul className="firm-finances__checklist">
                {report.closeChecklist.map((item) => (
                  <li
                    key={item.id}
                    className={`firm-finances__checklist-item firm-finances__checklist-item--${item.status}`}
                  >
                    <span className="firm-finances__checklist-icon" aria-hidden>
                      {item.status === "ok" ? "✓" : item.status === "warn" ? "!" : "×"}
                    </span>
                    <div>
                      <p className="firm-finances__checklist-label">{item.label}</p>
                      <p className="firm-finances__checklist-msg">{item.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="firm-finances__close-actions">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void copyStatement()}>
                  Copy statement
                </button>
                {report.monthClosed ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy || reopeningMonth}
                    onClick={() => void reopenMonth()}
                  >
                    {reopeningMonth ? "Reopening…" : "Reopen month"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-gold"
                      disabled={busy || closingMonth || closeBlockers || closeWarnings}
                      onClick={() => void closeMonth(false)}
                    >
                      {closingMonth ? "Closing…" : "Mark month reviewed"}
                    </button>
                    {closeWarnings && !closeBlockers ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy || closingMonth}
                        onClick={() => void closeMonth(true)}
                      >
                        Close anyway
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="firm-finances__sticky-summary no-print" aria-hidden={false}>
              <span className="firm-finances__sticky-total amount-serif">{formatPeso(report.totalIncome)}</span>
              {ALLOCATION_BUCKET_ORDER.map((key) => (
                <span key={key} className={`firm-finances__sticky-bucket firm-finances__sticky-bucket--${key}`}>
                  {BUCKET_SHORT[key]} {formatPeso(report.splits[key])}
                </span>
              ))}
            </div>

            <div className="firm-finances__income-hero">
              <div className="firm-finances__income-hero-accent" aria-hidden />
              <div className="firm-finances__income-hero-body">
                <p className="firm-finances__income-eyebrow">Office income · {report.monthLabel}</p>
                <p className="firm-finances__income-total amount-serif">{formatPeso(report.totalIncome)}</p>
                <p className="firm-finances__income-meta">
                  {report.lines.length} qualifying receipt{report.lines.length === 1 ? "" : "s"}
                </p>
                <div className="firm-finances__source-strip">
                  <span>
                    Acceptance {formatPeso(report.sourceBreakdown.acceptance)}
                    {report.totalAcceptanceFirmShare > 0
                      ? ` (${formatPeso(report.totalAcceptanceFirmShare)} firm)`
                      : ""}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Professional {formatPeso(report.sourceBreakdown.professional)}</span>
                  <span aria-hidden>·</span>
                  <span>Notarial {formatPeso(report.sourceBreakdown.notarial)}</span>
                </div>
              </div>
            </div>

            <div className="firm-finances__bucket-grid">
              {ALLOCATION_BUCKET_ORDER.map((key: AllocationBucketKey) => (
                <article key={key} className={`firm-finances__bucket firm-finances__bucket--${key}`}>
                  <p className="firm-finances__bucket-short">{BUCKET_SHORT[key]}</p>
                  <p className="firm-finances__bucket-label">{ALLOCATION_BUCKET_LABELS[key]}</p>
                  <p className="firm-finances__bucket-value amount-serif">{formatPeso(report.splits[key])}</p>
                  <p className="firm-finances__bucket-pct">{report.settings.percents[key]}% this month</p>
                  <p className="firm-finances__bucket-balance">
                    Balance {formatPeso(report.bucketBalances.current[key])}
                  </p>
                </article>
              ))}
            </div>

            <div className="firm-finances__bucket-withdraw no-print">
              <div className="firm-finances__section-head">
                <p className="firm-finances__section-title">Bucket withdrawals & adjustments</p>
                <p className="firm-finances__section-desc">
                  Record spending from a bucket · use negative amounts for withdrawals
                </p>
              </div>
              <div className="firm-finances__withdraw-form">
                <label className="firm-finances__withdraw-field">
                  <span>Bucket</span>
                  <select
                    className="field"
                    value={adjustBucket}
                    disabled={busy || adjustingBucket}
                    onChange={(e) => setAdjustBucket(e.target.value as AllocationBucketKey)}
                  >
                    {ALLOCATION_BUCKET_ORDER.map((key) => (
                      <option key={key} value={key}>
                        {ALLOCATION_BUCKET_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="firm-finances__withdraw-field">
                  <span>Amount</span>
                  <input
                    className="field"
                    type="number"
                    step="0.01"
                    placeholder="-5000"
                    value={adjustAmount}
                    disabled={busy || adjustingBucket}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                </label>
                <label className="firm-finances__withdraw-field firm-finances__withdraw-field--wide">
                  <span>Note</span>
                  <input
                    className="field"
                    value={adjustNote}
                    disabled={busy || adjustingBucket}
                    placeholder="Office rent · June"
                    onChange={(e) => setAdjustNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary firm-finances__withdraw-btn"
                  disabled={busy || adjustingBucket}
                  onClick={() => void submitBucketAdjustment()}
                >
                  {adjustingBucket ? "Saving…" : "Record adjustment"}
                </button>
              </div>
              {report.bucketAdjustments.length ? (
                <ul className="firm-finances__withdraw-log">
                  {[...report.bucketAdjustments].reverse().slice(0, 12).map((entry) => (
                    <li key={entry.id} className="firm-finances__withdraw-row">
                      <span className="firm-finances__withdraw-date">{entry.date}</span>
                      <span className={`firm-finances__withdraw-bucket firm-finances__withdraw-bucket--${entry.bucket}`}>
                        {BUCKET_SHORT[entry.bucket]}
                      </span>
                      <span className="firm-finances__withdraw-note">{entry.note}</span>
                      <span
                        className={`firm-finances__withdraw-amount amount-serif ${
                          entry.amount < 0 ? "is-negative" : ""
                        }`}
                      >
                        {formatPeso(entry.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact message="No bucket adjustments recorded yet." />
              )}
            </div>

            {report.unclassifiedIncome.length ? (
              <>
                {report.monthClosed ? (
                  <p className="firm-finances__closed-lock">
                    This month is closed — reopen it to reclassify payments in Needs review.
                  </p>
                ) : null}
                <div className="firm-finances__section-head">
                  <p className="firm-finances__section-title">Needs review</p>
                  <p className="firm-finances__section-desc">
                    Payments not yet in office split or appearance attribution · {formatPeso(report.totalUnclassifiedIncome)}
                  </p>
                </div>
                <ul className="firm-finances__review-list">
                  {report.unclassifiedIncome.map((line) => (
                    <li key={line.id} className="firm-finances__review-row">
                      <div>
                        <p className="firm-finances__review-title">{line.label}</p>
                        <p className="firm-finances__review-meta">
                          {line.reason} · {line.date} · {line.clientCode}
                          {line.clientName ? ` · ${line.clientName}` : ""}
                        </p>
                      </div>
                      <p className="firm-finances__review-amount amount-serif">{formatPeso(line.amount)}</p>
                      <div className="firm-finances__review-actions">
                        <select
                          id={`reclassify-${line.id}`}
                          className="field firm-finances__review-select"
                          defaultValue="Professional Fee"
                          disabled={busy || reclassifyBusyId === line.id || report.monthClosed}
                          aria-label={`Reclassify ${line.clientCode}`}
                        >
                          {PAYMENT_INCOME_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busy || reclassifyBusyId === line.id || report.monthClosed}
                          onClick={() => {
                            const select = document.getElementById(`reclassify-${line.id}`) as HTMLSelectElement | null;
                            const incomeType = (select?.value || "Professional Fee") as PaymentIncomeType;
                            void reclassifyPayment(line, incomeType);
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="firm-finances__section-head">
              <p className="firm-finances__section-title">Qualifying receipts</p>
              <p className="firm-finances__section-desc">Ledger payments and notarizations in this split</p>
            </div>

            {report.lines.length ? (
              <ul className="firm-finances__ledger">
                {report.lines.map((line) => (
                  <li key={line.id} className="firm-finances__ledger-row">
                    <div className="firm-finances__ledger-main">
                      <span className={`firm-finances__source firm-finances__source--${line.source}`}>
                        {sourceLabel(line)}
                      </span>
                      <p className="firm-finances__ledger-title">{line.label}</p>
                      <p className="firm-finances__ledger-meta">
                        {line.date}
                        <span aria-hidden> · </span>
                        {line.clientCode}
                        {line.clientName ? ` · ${line.clientName}` : ""}
                      </p>
                    </div>
                    <p className="firm-finances__ledger-amount amount-serif">{formatPeso(line.amount)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No office income this month"
                message="Record payments with an income type, or notarizations, then refresh."
              />
            )}

            <div className="firm-finances__appearance">
              <div className="firm-finances__appearance-head">
                <div>
                  <p className="firm-finances__section-title">Acceptance fees</p>
                  <p className="firm-finances__section-desc">
                    {acceptanceFeeSharingSummary()} · other lawyer from client profile (co-assigned attorney)
                  </p>
                </div>
                <p className="firm-finances__appearance-total amount-serif">{formatPeso(report.totalAcceptanceFees)}</p>
              </div>

              {unassignedAcceptance ? (
                <div className="firm-finances__unassigned-alert">
                  <p className="firm-finances__unassigned-title">
                    {formatPeso(unassignedAcceptance.total)} need a handling associate — set the associate on the client
                    profile (Atty. Hernandez is on every matter; the associate is April or Jeff)
                  </p>
                  <ul className="firm-finances__unassigned-lines">
                    {unassignedAcceptance.lines.map((line) => (
                      <li key={line.id}>
                        <a href={matterHref(line.clientCode)} className="firm-finances__unassigned-link">
                          {line.clientCode}
                          {line.clientName ? ` · ${line.clientName}` : ""} · {formatPeso(line.amount)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.totalAcceptanceFees > 0 ? (
                <div className="firm-finances__appearance-grid">
                  <article className="firm-finances__attorney-card">
                    <div className="firm-finances__attorney-head">
                      <span className="firm-finances__attorney-seal" aria-hidden>
                        F
                      </span>
                      <div>
                        <p className="firm-finances__attorney-name">Firm share</p>
                        <p className="firm-finances__attorney-count">
                          {ACCEPTANCE_FEE_SHARE_PERCENTS.firm}% · included in office buckets above
                        </p>
                      </div>
                      <p className="firm-finances__attorney-total amount-serif">
                        {formatPeso(report.acceptanceFeeSharing.firmTotal)}
                      </p>
                    </div>
                  </article>

                  <article className="firm-finances__attorney-card">
                    <div className="firm-finances__attorney-head">
                      <span className="firm-finances__attorney-seal" aria-hidden>
                        {attorneyInitials(report.acceptanceFeeSharing.managingPartnerName)}
                      </span>
                      <div>
                        <p className="firm-finances__attorney-name">{report.acceptanceFeeSharing.managingPartnerName}</p>
                        <p className="firm-finances__attorney-count">
                          {report.acceptanceFees.length} acceptance fee{report.acceptanceFees.length === 1 ? "" : "s"} ·{" "}
                          {ACCEPTANCE_FEE_SHARE_PERCENTS.managingPartner}% share
                        </p>
                      </div>
                      <p className="firm-finances__attorney-total amount-serif">
                        {formatPeso(report.acceptanceFeeSharing.managingPartnerTotal)}
                      </p>
                    </div>
                  </article>

                  {report.acceptanceFeeSharing.byAssociate
                    .filter((group) => group.associateName !== UNASSIGNED_ATTORNEY_LABEL)
                    .map((group) => (
                      <article key={group.associateName} className="firm-finances__attorney-card">
                        <div className="firm-finances__attorney-head">
                          <span className="firm-finances__attorney-seal" aria-hidden>
                            {attorneyInitials(group.associateName)}
                          </span>
                          <div>
                            <p className="firm-finances__attorney-name">{group.associateName}</p>
                            <p className="firm-finances__attorney-count">
                              {group.lines.length} acceptance fee{group.lines.length === 1 ? "" : "s"} ·{" "}
                              {ACCEPTANCE_FEE_SHARE_PERCENTS.associate}% share
                            </p>
                          </div>
                          <p className="firm-finances__attorney-total amount-serif">{formatPeso(group.shareTotal)}</p>
                        </div>
                        <ul className="firm-finances__attorney-lines">
                          {group.lines.map((line) => (
                            <li key={line.id}>
                              <a href={matterHref(line.clientCode)} className="firm-finances__attorney-line-link">
                                {line.clientCode}
                                {line.clientName ? ` · ${line.clientName}` : ""} · {formatPeso(line.amount)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                </div>
              ) : (
                <EmptyState
                  title="No acceptance fees this month"
                  message={`Record acceptance fee payments on client ledgers to see the ${ACCEPTANCE_FEE_SHARE_PERCENTS.firm}/${ACCEPTANCE_FEE_SHARE_PERCENTS.managingPartner}/${ACCEPTANCE_FEE_SHARE_PERCENTS.associate} split.`}
                />
              )}
            </div>

            <div className="firm-finances__appearance">
              <div className="firm-finances__appearance-head">
                <div>
                  <p className="firm-finances__section-title">Drafting pleading fees</p>
                  <p className="firm-finances__section-desc">
                    {pleadingFeeSharingSummary()} · drafting lawyer from event / charge details
                  </p>
                </div>
                <p className="firm-finances__appearance-total amount-serif">{formatPeso(report.totalPleadingFees)}</p>
              </div>

              {report.totalPleadingFees > 0 ? (
                <div className="firm-finances__appearance-grid">
                  <article className="firm-finances__attorney-card">
                    <div className="firm-finances__attorney-head">
                      <span className="firm-finances__attorney-seal" aria-hidden>
                        F
                      </span>
                      <div>
                        <p className="firm-finances__attorney-name">Firm share</p>
                        <p className="firm-finances__attorney-count">
                          {PLEADING_FEE_SHARE_PERCENTS.firm}% · included in office buckets above
                        </p>
                      </div>
                      <p className="firm-finances__attorney-total amount-serif">
                        {formatPeso(report.pleadingFeeSharing.firmTotal)}
                      </p>
                    </div>
                  </article>
                  <article className="firm-finances__attorney-card">
                    <div className="firm-finances__attorney-head">
                      <span className="firm-finances__attorney-seal" aria-hidden>
                        {attorneyInitials(report.pleadingFeeSharing.managingPartnerName)}
                      </span>
                      <div>
                        <p className="firm-finances__attorney-name">{report.pleadingFeeSharing.managingPartnerName}</p>
                        <p className="firm-finances__attorney-count">
                          {PLEADING_FEE_SHARE_PERCENTS.managingPartner}% managing partner share
                        </p>
                      </div>
                      <p className="firm-finances__attorney-total amount-serif">
                        {formatPeso(report.pleadingFeeSharing.managingPartnerTotal)}
                      </p>
                    </div>
                  </article>
                  {report.pleadingFeeSharing.byDrafter.map((group) => (
                    <article key={group.drafterName} className="firm-finances__attorney-card">
                      <div className="firm-finances__attorney-head">
                        <span className="firm-finances__attorney-seal" aria-hidden>
                          {attorneyInitials(group.drafterName)}
                        </span>
                        <div>
                          <p className="firm-finances__attorney-name">{group.drafterName}</p>
                          <p className="firm-finances__attorney-count">
                            {group.lines.length} pleading fee{group.lines.length === 1 ? "" : "s"} · drafter share
                          </p>
                        </div>
                        <p className="firm-finances__attorney-total amount-serif">{formatPeso(group.shareTotal)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No drafting pleading fees this month"
                  message="Check “Add drafting pleading fee” when saving a court filing event, then record payment on the client ledger with income type Pleading Fee."
                />
              )}
            </div>

            <div className="firm-finances__appearance">
              <div className="firm-finances__appearance-head">
                <div>
                  <p className="firm-finances__section-title">Appearance fees</p>
                  <p className="firm-finances__section-desc">{appearanceFeeSharingSummary()} · not in office split</p>
                </div>
                <p className="firm-finances__appearance-total amount-serif">{formatPeso(report.totalAppearanceFees)}</p>
              </div>

              {unassignedAppearance ? (
                <div className="firm-finances__unassigned-alert">
                  <p className="firm-finances__unassigned-title">
                    {formatPeso(unassignedAppearance.total)} unassigned — set attorney on client profile
                  </p>
                  <ul className="firm-finances__unassigned-lines">
                    {unassignedAppearance.lines.map((line) => (
                      <li key={line.id}>
                        <a href={matterHref(line.clientCode)} className="firm-finances__unassigned-link">
                          {line.clientCode}
                          {line.clientName ? ` · ${line.clientName}` : ""} · {formatPeso(line.amount)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.appearanceFeeByAttorney.length ? (
                <div className="firm-finances__appearance-grid">
                  {report.appearanceFeeByAttorney.map((group) => (
                    <article
                      key={group.assignedAttorney}
                      className={`firm-finances__attorney-card ${
                        group.assignedAttorney === UNASSIGNED_ATTORNEY_LABEL
                          ? "firm-finances__attorney-card--warn"
                          : ""
                      }`}
                    >
                      <div className="firm-finances__attorney-head">
                        <span className="firm-finances__attorney-seal" aria-hidden>
                          {attorneyInitials(group.assignedAttorney)}
                        </span>
                        <div>
                          <p className="firm-finances__attorney-name">{group.assignedAttorney}</p>
                          <p className="firm-finances__attorney-count">
                            {group.lines.length} appearance fee{group.lines.length === 1 ? "" : "s"}
                            {group.assignedAttorney !== UNASSIGNED_ATTORNEY_LABEL
                              ? ` · ${attorneyShareLine(group)}`
                              : ""}
                          </p>
                        </div>
                        <p className="firm-finances__attorney-total amount-serif">{formatPeso(group.total)}</p>
                      </div>
                      {group.assignedAttorney !== UNASSIGNED_ATTORNEY_LABEL ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm firm-finances__attorney-copy"
                          disabled={busy}
                          onClick={() => void copyAppearanceStatement(group)}
                        >
                          Copy statement
                        </button>
                      ) : null}
                      <ul className="firm-finances__attorney-lines">
                        {group.lines.map((line) => (
                          <li key={line.id} className="firm-finances__attorney-line">
                            <span>
                              <span className="firm-finances__attorney-line-date">{line.date}</span>
                              <span className="firm-finances__attorney-line-client">
                                {line.clientCode}
                                {line.clientName ? ` · ${line.clientName}` : ""}
                              </span>
                            </span>
                            <span className="amount-serif">{formatPeso(line.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  message={`No appearance fee payments for ${report.monthLabel}.`}
                />
              )}

              {staffByLawyer.length ? (
                <div className="firm-finances__team-roster">
                  <p className="firm-finances__section-title">Payroll staff by supervising lawyer</p>
                  <p className="firm-finances__section-desc">
                    From Payroll roster — links staff compensation to associate lawyers.
                  </p>
                  <ul className="firm-finances__team-roster-list">
                    {staffByLawyer.map(([lawyer, staff]) => (
                      <li key={lawyer} className="firm-finances__team-roster-item">
                        <strong>{lawyer}</strong>
                        <span className="text-muted">
                          {staff.map((person) => person.displayName).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
