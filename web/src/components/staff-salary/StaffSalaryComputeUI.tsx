"use client";

import type { ReactNode } from "react";
import { formatPeso } from "@/lib/gl-config";

export type StaffSalaryToolTab = "overtime" | "13th" | "adjustments" | "cashAdvances";

const TOOL_TABS: { id: StaffSalaryToolTab; label: string; hint: string }[] = [
  { id: "overtime", label: "Overtime", hint: "Extra hours · Labor Code" },
  { id: "adjustments", label: "Adjustments", hint: "Bonuses & deductions" },
  { id: "cashAdvances", label: "Cash advances", hint: "Installment repayments" },
  { id: "13th", label: "13th month", hint: "Year-end · PD 851" }
];

type ToolTabsProps = {
  active: StaffSalaryToolTab;
  onChange: (tab: StaffSalaryToolTab) => void;
  disabled?: boolean;
};

export function StaffSalaryToolTabs({ active, onChange, disabled }: ToolTabsProps) {
  return (
    <nav className="staff-salary__tool-tabs" aria-label="Payroll tools">
      {TOOL_TABS.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`staff-salary__tool-tab ${isActive ? "staff-salary__tool-tab--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            disabled={disabled}
            onClick={() => onChange(tab.id)}
          >
            <span className="staff-salary__tool-tab-step" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="staff-salary__tool-tab-copy">
              <span className="staff-salary__tool-tab-label">{tab.label}</span>
              <span className="staff-salary__tool-tab-hint">{tab.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

type ToolPanelProps = {
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
};

export function StaffSalaryToolPanel({ eyebrow, title, lede, children }: ToolPanelProps) {
  return (
    <section className="staff-salary__tool-panel">
      <header className="staff-salary__tool-panel-head">
        <p className="staff-salary__tool-eyebrow">{eyebrow}</p>
        <h3 className="staff-salary__tool-title">{title}</h3>
        {lede ? <p className="staff-salary__tool-lede">{lede}</p> : null}
      </header>
      {children}
    </section>
  );
}

type RateCard = {
  label: string;
  value: string;
  hint?: string;
};

export function StaffSalaryRateCards({ items }: { items: RateCard[] }) {
  return (
    <div className="staff-salary__rate-grid">
      {items.map((item) => (
        <div key={item.label} className="staff-salary__rate-card">
          <p className="staff-salary__rate-card-label">{item.label}</p>
          <p className="staff-salary__rate-card-value amount-serif">{item.value}</p>
          {item.hint ? <p className="staff-salary__rate-card-hint">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export type ComputeSheetRow = {
  label: string;
  detail?: string;
  amount: string;
  tone?: "default" | "subtotal" | "total" | "deduct" | "muted";
};

export function StaffSalaryComputeSheet({ rows }: { rows: ComputeSheetRow[] }) {
  return (
    <div className="staff-salary__compute-sheet staff-salary__compute-sheet--tool">
      <div className="staff-salary__compute-head" aria-hidden>
        <span>Step</span>
        <span>Amount (PHP)</span>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={`staff-salary__compute-row ${row.tone === "total" ? "staff-salary__compute-row--total" : row.tone === "subtotal" ? "staff-salary__compute-row--subtotal" : row.tone === "deduct" ? "staff-salary__compute-row--deduct" : row.tone === "muted" ? "staff-salary__compute-row--muted" : ""}`}
        >
          <div className="staff-salary__compute-copy">
            <p className="staff-salary__compute-label">{row.label}</p>
            {row.detail ? <p className="staff-salary__compute-detail">{row.detail}</p> : null}
          </div>
          <p className="staff-salary__compute-amount amount-serif">{row.amount}</p>
        </div>
      ))}
    </div>
  );
}

type SetupBarProps = {
  baseSalary: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  locked: boolean;
  busy: boolean;
  midPaid: boolean;
  endPaid: boolean;
  grossTotal: number;
};

export function StaffSalarySetupBar({
  baseSalary,
  onChange,
  onSave,
  saving,
  locked,
  busy,
  midPaid,
  endPaid,
  grossTotal
}: SetupBarProps) {
  return (
    <section className="staff-salary__setup-bar">
      <div className="staff-salary__setup-head">
        <div className="staff-salary__setup-copy">
          <p className="staff-salary__setup-eyebrow">01 · Payroll setup</p>
          <p className="staff-salary__setup-lede">Set the monthly contract rate first — all tools below use this base.</p>
        </div>
      </div>
      <div className="staff-salary__setup-form">
        <label className="staff-salary__setup-field">
          <span>Base salary</span>
          <input
            className="field staff-salary__setup-input"
            type="number"
            min={0}
            step="0.01"
            value={baseSalary}
            disabled={busy || saving || locked}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="staff-salary__btn staff-salary__btn--primary staff-salary__setup-save"
          disabled={busy || saving || locked}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save base salary"}
        </button>
      </div>
      <div className="staff-salary__setup-metrics">
        <div className="staff-salary__setup-metric">
          <span>Mid-month</span>
          <strong className={midPaid ? "staff-salary__setup-metric--released" : "staff-salary__setup-metric--pending"}>
            {midPaid ? "Released" : "Pending"}
          </strong>
        </div>
        <div className="staff-salary__setup-metric">
          <span>End-month</span>
          <strong className={endPaid ? "staff-salary__setup-metric--released" : "staff-salary__setup-metric--pending"}>
            {endPaid ? "Released" : "Pending"}
          </strong>
        </div>
        <div className="staff-salary__setup-metric staff-salary__setup-metric--total">
          <span>Month gross</span>
          <strong className="amount-serif">{formatPeso(grossTotal)}</strong>
        </div>
      </div>
    </section>
  );
}

export function StaffSalaryResultHero({
  label,
  detail,
  amount,
  meta
}: {
  label: string;
  detail?: string;
  amount: string;
  meta?: string;
}) {
  return (
    <div className="staff-salary__result-hero">
      <div>
        <p className="staff-salary__result-hero-label">{label}</p>
        {detail ? <p className="staff-salary__result-hero-detail">{detail}</p> : null}
        {meta ? <p className="staff-salary__result-hero-meta">{meta}</p> : null}
      </div>
      <p className="staff-salary__result-hero-amount amount-serif">{amount}</p>
    </div>
  );
}

export function StaffSalaryFormGrid({ children }: { children: ReactNode }) {
  return <div className="staff-salary__form-grid">{children}</div>;
}

export function StaffSalaryField({
  label,
  wide,
  children
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`staff-salary__field ${wide ? "staff-salary__field--wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StaffSalaryActions({ children }: { children: ReactNode }) {
  return <div className="staff-salary__tool-actions">{children}</div>;
}

type EntryActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  disabled?: boolean;
  editing?: boolean;
  deleting?: boolean;
};

export function StaffSalaryEntryActions({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  disabled = false,
  editing = false,
  deleting = false
}: EntryActionsProps) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className="staff-salary__entry-actions">
      {onEdit ? (
        <button
          type="button"
          className="staff-salary__btn staff-salary__btn--outline staff-salary__entry-action"
          disabled={disabled || deleting}
          onClick={onEdit}
        >
          {editing ? "Editing…" : editLabel}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="staff-salary__btn staff-salary__btn--outline staff-salary__entry-action staff-salary__entry-action--danger"
          disabled={disabled || editing || deleting}
          onClick={onDelete}
        >
          {deleting ? "Deleting…" : deleteLabel}
        </button>
      ) : null}
    </div>
  );
}
