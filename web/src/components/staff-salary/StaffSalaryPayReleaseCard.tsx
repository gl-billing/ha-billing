"use client";

import {
  StaffSalaryComputeSheet,
  type ComputeSheetRow
} from "@/components/staff-salary/StaffSalaryComputeUI";
import { formatPeso } from "@/lib/gl-config";
import type { StaffPayPeriod, StaffPayRun, StaffSalaryComputeRow, StaffSalaryReport } from "@/lib/staff-salary";
import { formatStaffPayrollTransferMemo } from "@/lib/staff-salary";

type Props = {
  run: StaffPayRun;
  columnLabel: string;
  columnHint: string;
  computeRows: ComputeSheetRow[];
  report: StaffSalaryReport;
  busy: boolean;
  closingPeriod: StaffPayPeriod | "";
  reopeningPeriod: StaffPayPeriod | "";
  transferringPeriod: StaffPayPeriod | "";
  transferRef: string;
  onTransferRefChange: (value: string) => void;
  onCopyTransferMemo: () => void;
  onMarkTransferred: () => void;
  onReopen: () => void;
  onMarkPaid: () => void;
  onEmailPayslip: () => void;
  onPreviewPayslip: () => void;
  previewingPeriod: boolean;
  emailingPeriod: boolean;
};

export function StaffSalaryPayReleaseCard({
  run,
  columnLabel,
  columnHint,
  computeRows,
  report,
  busy,
  closingPeriod,
  reopeningPeriod,
  transferringPeriod,
  transferRef,
  onTransferRefChange,
  onCopyTransferMemo,
  onMarkTransferred,
  onReopen,
  onMarkPaid,
  onEmailPayslip,
  onPreviewPayslip,
  previewingPeriod,
  emailingPeriod
}: Props) {
  const statusClass = run.transferred
    ? "staff-salary__voucher--transferred"
    : run.paid
      ? "staff-salary__voucher--released"
      : "staff-salary__voucher--pending";

  return (
    <article
      className={`staff-salary__voucher staff-salary__voucher--${run.period} ${statusClass}`}
      aria-label={`${columnLabel} payment release`}
    >
      <div className="staff-salary__voucher-column-head">
        <div>
          <p className="staff-salary__voucher-day">{columnLabel}</p>
          <p className="staff-salary__voucher-day-hint">{columnHint}</p>
        </div>
        {run.transferred ? (
          <span className="staff-salary__voucher-stamp staff-salary__voucher-stamp--transferred">Transferred</span>
        ) : run.paid ? (
          <span className="staff-salary__voucher-stamp staff-salary__voucher-stamp--released" aria-label="Released">
            <span className="staff-salary__voucher-stamp-frame">
              <span className="staff-salary__voucher-stamp-label">Released</span>
            </span>
          </span>
        ) : (
          <span className="staff-salary__voucher-stamp staff-salary__voucher-stamp--pending">
            <span
              className="staff-salary__voucher-stamp-mark staff-salary__voucher-stamp-mark--pending"
              aria-hidden
            >
              ○
            </span>
            Pending
          </span>
        )}
      </div>

      <p className="staff-salary__voucher-title">{run.label}</p>
      <p className="staff-salary__voucher-date">{run.payDateLabel}</p>
      <p className="staff-salary__voucher-meta">
        Nominal {run.nominalDayLabel}
        {run.shiftedFromWeekend ? " · prior business day" : ""}
      </p>

      {computeRows.length ? <StaffSalaryComputeSheet rows={computeRows} /> : null}

      <div className="staff-salary__voucher-total">
        <span>Amount due</span>
        <span className="amount-serif">{formatPeso(run.amount)}</span>
      </div>

      {run.paid && run.paidAt ? (
        <p className="staff-salary__voucher-recorded">Recorded {run.paidAt}</p>
      ) : null}
      {run.transferred && run.transferredAt ? (
        <p className="staff-salary__voucher-recorded">
          Transferred {run.transferredAt}
          {run.transferRef ? ` · ${run.transferRef}` : ""}
        </p>
      ) : null}

      {run.paid ? (
        <div className="staff-salary__transfer-memo no-print">
          <p className="staff-salary__transfer-memo-label">Bank memo</p>
          <p className="staff-salary__transfer-memo-text">{formatStaffPayrollTransferMemo(report, run)}</p>
        </div>
      ) : null}

      <div className="staff-salary__voucher-actions no-print">
        {run.paid ? (
          <>
            <div className="staff-salary__voucher-email-actions">
              <button
                type="button"
                className="staff-salary__btn staff-salary__btn--outline staff-salary__pay-btn"
                disabled={busy || previewingPeriod}
                onClick={onPreviewPayslip}
              >
                {previewingPeriod ? "Loading…" : "Preview email"}
              </button>
              <button
                type="button"
                className="staff-salary__btn staff-salary__btn--secondary staff-salary__pay-btn"
                disabled={busy || emailingPeriod}
                onClick={onEmailPayslip}
              >
                {emailingPeriod ? "Sending…" : "Email payslip"}
              </button>
              <button
                type="button"
                className="staff-salary__btn staff-salary__btn--secondary staff-salary__pay-btn"
                disabled={busy}
                onClick={onCopyTransferMemo}
              >
                Copy bank memo
              </button>
            </div>
            {!run.transferred ? (
              <>
                <label className="staff-salary__transfer-ref">
                  <span>Transfer ref</span>
                  <input
                    className="field staff-salary__transfer-ref-input"
                    value={transferRef}
                    disabled={busy || transferringPeriod === run.period}
                    placeholder="BPI ref or date"
                    onChange={(e) => onTransferRefChange(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--primary staff-salary__pay-btn"
                  disabled={busy || transferringPeriod === run.period}
                  onClick={onMarkTransferred}
                >
                  {transferringPeriod === run.period ? "Saving…" : "Mark transferred"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--outline staff-salary__pay-btn"
              disabled={busy || reopeningPeriod === run.period}
              onClick={onReopen}
            >
              {reopeningPeriod === run.period ? "Reopening…" : "Reopen period"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="staff-salary__btn staff-salary__btn--primary staff-salary__pay-btn"
            disabled={busy || closingPeriod === run.period}
            onClick={onMarkPaid}
          >
            {closingPeriod === run.period ? "Recording…" : "Record payment"}
          </button>
        )}
      </div>
    </article>
  );
}

function mapComputeRows(
  rows: StaffSalaryComputeRow[],
  formatAmount: (row: StaffSalaryComputeRow) => string
): ComputeSheetRow[] {
  return rows.map((row) => ({
    label: row.label,
    detail: row.detail,
    amount: formatAmount(row),
    tone:
      row.tone === "total"
        ? ("total" as const)
        : row.tone === "subtotal"
          ? ("subtotal" as const)
          : row.tone === "deduct"
            ? ("deduct" as const)
            : ("default" as const)
  }));
}

export function payReleaseComputeRows(
  section: { rows: StaffSalaryComputeRow[] } | undefined,
  formatAmount: (row: StaffSalaryComputeRow) => string
): ComputeSheetRow[] {
  if (!section) return [];
  return mapComputeRows(section.rows, formatAmount);
}
