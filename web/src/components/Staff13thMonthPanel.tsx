"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import {
  StaffSalaryActions,
  StaffSalaryComputeSheet,
  StaffSalaryResultHero,
  StaffSalaryToolPanel
} from "@/components/staff-salary/StaffSalaryComputeUI";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { formatPeso } from "@/lib/gl-config";
import {
  formatStaff13thMonthStatementText,
  formatStaff13thMonthTransferMemo,
  STAFF_13TH_MONTH_STATUTE,
  staff13thMonthReference,
  type Staff13thMonthReport
} from "@/lib/staff-salary-13th-month";

type Props = {
  staffId: string;
  year: number;
  busy: boolean;
  embedded?: boolean;
  disabled?: boolean;
  onStatus: (message: string, isError?: boolean) => void;
  onPayrollChanged?: () => void;
};

export function Staff13thMonthPanel({
  staffId,
  year,
  busy,
  embedded = false,
  disabled = false,
  onStatus,
  onPayrollChanged
}: Props) {
  const [report, setReport] = useState<Staff13thMonthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingMonths, setSavingMonths] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [postingAdjustment, setPostingAdjustment] = useState(false);
  const [removingPayrollLine, setRemovingPayrollLine] = useState(false);
  const [updatingPayrollLine, setUpdatingPayrollLine] = useState(false);
  const [transferRef, setTransferRef] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/staff-salary/thirteenth-month?staffId=${encodeURIComponent(staffId)}&year=${year}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load 13th month pay.");
      setReport(json as Staff13thMonthReport);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load 13th month pay.";
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [staffId, year]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const computeRows = useMemo(() => {
    if (!report) return [];
    const monthRows = report.months
      .filter((line) => line.included)
      .map((line, index) => ({
        label: `${index + 1} · ${line.monthLabel} ${report.year}`,
        detail: "Monthly basic salary",
        amount: formatPeso(line.baseSalary),
        tone: "muted" as const
      }));

    return [
      ...monthRows,
      {
        label: "Total basic salary earned",
        detail: `${report.monthsWorked} month${report.monthsWorked === 1 ? "" : "s"} × ${formatPeso(report.monthlyBaseSalary)}`,
        amount: formatPeso(report.totalBasicSalary),
        tone: "subtotal" as const
      },
      {
        label: "13th month pay",
        detail: `${formatPeso(report.totalBasicSalary)} ÷ 12`,
        amount: formatPeso(report.thirteenthMonthPay),
        tone: "total" as const
      }
    ];
  }, [report]);

  async function toggleMonth(month: number) {
    if (!report || disabled) return;
    const included = report.months.filter((line) => line.included).map((line) => line.month);
    const next = included.includes(month)
      ? included.filter((value) => value !== month)
      : [...included, month];
    if (!next.length) {
      onStatus("Keep at least one month included.", true);
      return;
    }

    setSavingMonths(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year, months: next })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update months.");
      setReport(json.report as Staff13thMonthReport);
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not update months.", true);
    } finally {
      setSavingMonths(false);
    }
  }

  async function markPaid() {
    if (!report) return;
    if (
      !window.confirm(
        `Record ${year} 13th month pay for ${report.staffName}? Amount: ${formatPeso(report.thirteenthMonthPay)}`
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark 13th month pay.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "13th month pay marked.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not mark 13th month pay.", true);
    } finally {
      setClosing(false);
    }
  }

  async function reopenPay() {
    if (!report?.paid) return;
    if (!window.confirm(`Reopen ${year} 13th month pay for ${report.staffName}?`)) return;
    setReopening(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reopen 13th month pay.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "13th month pay reopened.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not reopen 13th month pay.", true);
    } finally {
      setReopening(false);
    }
  }

  async function markTransferred() {
    if (!report?.paid || report.transferred) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year, transferRef })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark transfer.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "Transfer recorded.");
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not mark transfer.", true);
    } finally {
      setTransferring(false);
    }
  }

  async function postToDecemberPayroll() {
    if (!report) return;
    if (
      !window.confirm(
        `Post ${formatPeso(report.thirteenthMonthPay)} to December payroll for ${report.staffName}?`
      )
    ) {
      return;
    }
    setPostingAdjustment(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month/post-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not post to December payroll.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "Posted to December payroll.");
      onPayrollChanged?.();
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not post to December payroll.", true);
    } finally {
      setPostingAdjustment(false);
    }
  }

  async function removeFromDecemberPayroll() {
    if (!report?.postedToPayroll) return;
    if (!window.confirm(`Remove ${year} 13th month pay from December payroll?`)) return;
    setRemovingPayrollLine(true);
    try {
      const res = await fetch(
        `/api/staff-salary/thirteenth-month/post-adjustment?staffId=${encodeURIComponent(staffId)}&year=${year}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not remove from December payroll.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "Removed from December payroll.");
      onPayrollChanged?.();
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not remove from December payroll.", true);
    } finally {
      setRemovingPayrollLine(false);
    }
  }

  async function updateDecemberPayrollLine() {
    if (!report?.postedToPayroll) return;
    setUpdatingPayrollLine(true);
    try {
      const res = await fetch("/api/staff-salary/thirteenth-month/post-adjustment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, year })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update December payroll line.");
      setReport(json.report as Staff13thMonthReport);
      onStatus(json.message || "December payroll line updated.");
      onPayrollChanged?.();
    } catch (err) {
      onStatus(err instanceof Error ? err.message : "Could not update December payroll line.", true);
    } finally {
      setUpdatingPayrollLine(false);
    }
  }

  async function copyStatement() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatStaff13thMonthStatementText(report));
      onStatus("13th month statement copied.");
    } catch {
      onStatus("Could not copy statement.", true);
    }
  }

  async function copyTransferMemo() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatStaff13thMonthTransferMemo(report));
      onStatus("Bank transfer memo copied.");
    } catch {
      onStatus("Could not copy bank memo.", true);
    }
  }

  const locked = busy || disabled || savingMonths || Boolean(report?.paid);

  const body = (
    <>
      {error ? <p className="staff-salary__error">{error}</p> : null}

      {loading ? (
        <div className="staff-salary__loading staff-salary__loading--compact">
          <Skeleton className="h-40 w-full rounded-sm" />
        </div>
      ) : null}

      {report && !loading ? (
        <>
          <div className="staff-salary__13th-head">
            <div>
              <p className="staff-salary__13th-ref">{staff13thMonthReference(report)}</p>
              <p className="staff-salary__13th-meta">
                {report.monthsWorked} months counted · base {formatPeso(report.monthlyBaseSalary)} / month
              </p>
            </div>
            <span
              className={`staff-salary__slip-status ${report.transferred || report.paid ? "staff-salary__slip-status--done" : ""}`}
            >
              {report.transferred ? "Transferred" : report.paid ? "Released" : "Pending"}
            </span>
          </div>

          <div className="staff-salary__tool-block">
            <p className="staff-salary__tool-block-label">Select months to include</p>
            <div className="staff-salary__13th-month-grid">
              {report.months.map((line) => {
                const active = line.included;
                return (
                  <button
                    key={line.month}
                    type="button"
                    className={`staff-salary__13th-month-btn ${active ? "staff-salary__13th-month-btn--active" : ""}`}
                    disabled={locked || busy}
                    aria-pressed={active}
                    onClick={() => void toggleMonth(line.month)}
                  >
                    <span>{line.monthLabel}</span>
                    <span className="staff-salary__13th-month-amount amount-serif">
                      {active ? formatPeso(line.baseSalary) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {report.monthlyBaseSalary > 0 ? (
            <>
              <StaffSalaryComputeSheet rows={computeRows} />
              <StaffSalaryResultHero
                label="13th month pay due"
                detail={`${STAFF_13TH_MONTH_STATUTE} · basic salary only`}
                amount={formatPeso(report.thirteenthMonthPay)}
                meta={`${formatPeso(report.totalBasicSalary)} earned ÷ 12`}
              />
            </>
          ) : (
            <EmptyState compact message="Set a monthly base salary in Payroll setup before computing 13th month pay." />
          )}

          <StaffSalaryActions>
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--primary"
              disabled={busy || postingAdjustment || report.thirteenthMonthPay <= 0 || report.paid || report.postedToPayroll}
              onClick={() => void postToDecemberPayroll()}
            >
              {postingAdjustment ? "Posting…" : "Post to December payroll"}
            </button>
            {report.postedToPayroll ? (
              <>
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--secondary"
                  disabled={busy || updatingPayrollLine || report.paid}
                  onClick={() => void updateDecemberPayrollLine()}
                >
                  {updatingPayrollLine ? "Updating…" : "Update December payroll line"}
                </button>
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--outline staff-salary__entry-action--danger"
                  disabled={busy || removingPayrollLine || report.paid}
                  onClick={() => void removeFromDecemberPayroll()}
                >
                  {removingPayrollLine ? "Removing…" : "Remove from December payroll"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--secondary"
              disabled={busy}
              onClick={() => void copyStatement()}
            >
              Copy statement
            </button>
            {report.paid ? (
              <>
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--secondary"
                  disabled={busy}
                  onClick={() => void copyTransferMemo()}
                >
                  Copy bank memo
                </button>
                {!report.transferred ? (
                  <>
                    <label className="staff-salary__transfer-ref">
                      <span>Transfer ref</span>
                      <input
                        className="field staff-salary__transfer-ref-input"
                        value={transferRef}
                        disabled={busy || transferring}
                        placeholder="BPI ref or date"
                        onChange={(e) => setTransferRef(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="staff-salary__btn staff-salary__btn--primary"
                      disabled={busy || transferring}
                      onClick={() => void markTransferred()}
                    >
                      {transferring ? "Saving…" : "Mark transferred"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--outline"
                  disabled={busy || reopening}
                  onClick={() => void reopenPay()}
                >
                  {reopening ? "Reopening…" : "Reopen"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="staff-salary__btn staff-salary__btn--primary"
                disabled={busy || closing || report.thirteenthMonthPay <= 0 || report.monthlyBaseSalary <= 0}
                onClick={() => void markPaid()}
              >
                {closing ? "Recording…" : "Record 13th month pay"}
              </button>
            )}
          </StaffSalaryActions>
        </>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <StaffSalaryToolPanel
        eyebrow="PD 851"
        title="13th month pay"
        lede="Total basic salary earned in the calendar year ÷ 12. Excludes allowance, field dispatch, and overtime."
      >
        {body}
      </StaffSalaryToolPanel>
    );
  }

  return <section className="staff-salary__tool-panel">{body}</section>;
}
