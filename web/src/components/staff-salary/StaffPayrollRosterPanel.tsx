"use client";

import { useCallback, useState } from "react";
import {
  ensureUniqueStaffPayrollId,
  type StaffPayrollRosterEntry
} from "@/lib/staff-payroll-roster";
import type { FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";
import { DEFAULT_STAFF_MONTHLY_ALLOWANCE, STAFF_PAYROLL_BANK } from "@/lib/staff-salary";
import { StaffSalaryField, StaffSalaryFormGrid } from "@/components/staff-salary/StaffSalaryComputeUI";

const EMPTY_DRAFT = (): Omit<StaffPayrollRosterEntry, "id"> => ({
  displayName: "",
  shortName: "",
  role: "",
  email: "",
  associatedLawyerName: "",
  associatedLawyerEmail: "",
  includesFieldDispatch: false,
  monthlyAllowance: DEFAULT_STAFF_MONTHLY_ALLOWANCE,
  payrollBank: STAFF_PAYROLL_BANK,
  payrollAccountNumber: "",
  active: true
});

type Props = {
  roster: StaffPayrollRosterEntry[];
  lawyers: FirmLawyerRosterEntry[];
  busy: boolean;
  onSaved: (roster: StaffPayrollRosterEntry[]) => void;
  onStatus: (message: string, isError?: boolean) => void;
};

export function StaffPayrollRosterPanel({ roster, lawyers, busy, onSaved, onStatus }: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT());
    setEditingId("");
  }, []);

  async function persistRoster(next: StaffPayrollRosterEntry[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/staff-salary/roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: next })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save payroll roster.");
      const saved = (json.roster || []) as StaffPayrollRosterEntry[];
      onSaved(saved);
      onStatus(editingId ? "Payroll staff updated." : "Payroll staff added.");
      resetDraft();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save payroll roster.", true);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: StaffPayrollRosterEntry) {
    setEditingId(entry.id);
    setDraft({
      displayName: entry.displayName,
      shortName: entry.shortName,
      role: entry.role,
      email: entry.email,
      associatedLawyerName: entry.associatedLawyerName,
      associatedLawyerEmail: entry.associatedLawyerEmail,
      includesFieldDispatch: entry.includesFieldDispatch,
      monthlyAllowance: entry.monthlyAllowance,
      payrollBank: entry.payrollBank,
      payrollAccountNumber: entry.payrollAccountNumber,
      active: entry.active
    });
  }

  async function handleSubmit() {
    const displayName = draft.displayName.trim();
    if (!displayName) {
      onStatus("Enter the staff member's full name.", true);
      return;
    }
    if (!draft.email.trim()) {
      onStatus("Enter the staff member's email address.", true);
      return;
    }

    const id = editingId || ensureUniqueStaffPayrollId(displayName, roster);
    const entry: StaffPayrollRosterEntry = {
      id,
      displayName,
      shortName: draft.shortName.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      associatedLawyerName: draft.associatedLawyerName.trim(),
      associatedLawyerEmail: draft.associatedLawyerEmail.trim(),
      includesFieldDispatch: draft.includesFieldDispatch,
      monthlyAllowance: draft.monthlyAllowance,
      payrollBank: draft.payrollBank.trim() || STAFF_PAYROLL_BANK,
      payrollAccountNumber: draft.payrollAccountNumber.trim(),
      active: true
    };

    const next = editingId
      ? roster.map((row) => (row.id === editingId ? entry : row))
      : [...roster, entry];
    await persistRoster(next);
  }

  async function handleRemove(id: string) {
    const next = roster.filter((row) => row.id !== id);
    await persistRoster(next);
  }

  return (
    <section className="staff-salary__panel staff-salary__panel--roster no-print">
      <div className="staff-salary__roster-head">
        <div>
          <p className="staff-salary__toolbar-label">Payroll roster</p>
          <p className="staff-salary__toolbar-hint">
            Add staff here first. Link each person to a supervising lawyer and email for payslips.
          </p>
        </div>
      </div>

      {roster.length ? (
        <ul className="staff-salary__roster-list">
          {roster.map((entry) => (
            <li key={entry.id} className="staff-salary__roster-item">
              <div className="staff-salary__roster-item-main">
                <strong>{entry.displayName}</strong>
                {entry.role ? <span className="text-muted"> · {entry.role}</span> : null}
                <div className="staff-salary__roster-item-meta text-muted">
                  {entry.email}
                  {entry.associatedLawyerName ? (
                    <>
                      {" "}
                      · Lawyer: {entry.associatedLawyerName}
                      {entry.associatedLawyerEmail ? ` (${entry.associatedLawyerEmail})` : ""}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="staff-salary__roster-item-actions">
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--secondary"
                  disabled={busy || saving}
                  onClick={() => startEdit(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="staff-salary__btn staff-salary__btn--secondary"
                  disabled={busy || saving}
                  onClick={() => void handleRemove(entry.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="staff-salary__roster-empty text-muted">No payroll staff yet. Add your first team member below.</p>
      )}

      <div className="staff-salary__roster-form">
        <p className="staff-salary__tool-block-label">{editingId ? "Edit staff" : "Add staff"}</p>
        <StaffSalaryFormGrid>
          <StaffSalaryField label="Full name *">
            <input
              className="field"
              value={draft.displayName}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g. Maria Santos"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Short name">
            <input
              className="field"
              value={draft.shortName}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, shortName: e.target.value }))}
              placeholder="Payslip greeting"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Role">
            <input
              className="field"
              value={draft.role}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
              placeholder="Secretary, Liaison, etc."
            />
          </StaffSalaryField>
          <StaffSalaryField label="Staff email *">
            <input
              className="field"
              type="email"
              value={draft.email}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="name@hernandezassociates.com"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Supervising lawyer">
            {lawyers.length ? (
              <select
                className="field"
                value={draft.associatedLawyerName}
                disabled={busy || saving}
                onChange={(e) => {
                  const lawyer = lawyers.find((row) => row.displayName === e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    associatedLawyerName: e.target.value,
                    associatedLawyerEmail: lawyer?.email || prev.associatedLawyerEmail
                  }));
                }}
              >
                <option value="">Select lawyer…</option>
                {lawyers.map((lawyer) => (
                  <option key={lawyer.id} value={lawyer.displayName}>
                    {lawyer.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field"
                value={draft.associatedLawyerName}
                disabled={busy || saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, associatedLawyerName: e.target.value }))}
                placeholder="Add associate lawyers below first"
              />
            )}
          </StaffSalaryField>
          <StaffSalaryField label="Lawyer email">
            <input
              className="field"
              type="email"
              value={draft.associatedLawyerEmail}
              disabled={busy || saving || Boolean(lawyers.length && draft.associatedLawyerName)}
              onChange={(e) => setDraft((prev) => ({ ...prev, associatedLawyerEmail: e.target.value }))}
              placeholder="Filled when you pick a lawyer"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Payroll bank">
            <input
              className="field"
              value={draft.payrollBank}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, payrollBank: e.target.value }))}
            />
          </StaffSalaryField>
          <StaffSalaryField label="Payroll account no.">
            <input
              className="field"
              value={draft.payrollAccountNumber}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, payrollAccountNumber: e.target.value }))}
            />
          </StaffSalaryField>
        </StaffSalaryFormGrid>

        <label className="form-check staff-salary__roster-check">
          <input
            type="checkbox"
            checked={draft.includesFieldDispatch}
            disabled={busy || saving}
            onChange={(e) => setDraft((prev) => ({ ...prev, includesFieldDispatch: e.target.checked }))}
          />
          <span className="form-check__copy">Include field-dispatch service credits on payroll (liaison staff)</span>
        </label>

        <div className="staff-salary__roster-form-actions">
          <button
            type="button"
            className="staff-salary__btn staff-salary__btn--primary"
            disabled={busy || saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add to roster"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="staff-salary__btn staff-salary__btn--secondary"
              disabled={busy || saving}
              onClick={resetDraft}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
