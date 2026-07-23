"use client";

import { useCallback, useState } from "react";
import {
  ensureManagingPartnerOnRoster,
  ensureUniqueFirmLawyerId,
  isManagingPartnerRosterEntry,
  normalizeFirmLawyerDisplayName,
  type FirmLawyerRosterEntry
} from "@/lib/firm-lawyers-roster";
import { StaffSalaryField, StaffSalaryFormGrid } from "@/components/staff-salary/StaffSalaryComputeUI";

const EMPTY_DRAFT = (): Omit<FirmLawyerRosterEntry, "id"> => ({
  displayName: "",
  designation: "",
  email: "",
  feeSharePercent: 100,
  overseesTasks: true,
  active: true
});

type Props = {
  roster: FirmLawyerRosterEntry[];
  busy: boolean;
  onSaved: (roster: FirmLawyerRosterEntry[]) => void;
  onStatus: (message: string, isError?: boolean) => void;
};

export function FirmLawyersRosterPanel({ roster, busy, onSaved, onStatus }: Props) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  const resetDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT());
    setEditingId("");
  }, []);

  async function persistRoster(next: FirmLawyerRosterEntry[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/firm-lawyers/roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: next })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save lawyers roster.");
      const saved = (json.roster || []) as FirmLawyerRosterEntry[];
      onSaved(saved);
      onStatus(json.message || (editingId ? "Lawyer updated." : "Lawyer added."));
      resetDraft();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save lawyers roster.", true);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: FirmLawyerRosterEntry) {
    setEditingId(entry.id);
    setDraft({
      displayName: entry.displayName,
      designation: entry.designation || "",
      email: entry.email,
      feeSharePercent: entry.feeSharePercent,
      overseesTasks: entry.overseesTasks,
      active: entry.active
    });
  }

  async function handleSubmit() {
    const displayName = normalizeFirmLawyerDisplayName(draft.displayName);
    if (!displayName) {
      onStatus("Enter the lawyer's name.", true);
      return;
    }
    if (!draft.email.trim()) {
      onStatus("Enter the lawyer's email address.", true);
      return;
    }

    const id = editingId || ensureUniqueFirmLawyerId(displayName, roster);
    const entry: FirmLawyerRosterEntry = {
      id,
      displayName,
      designation: draft.designation?.trim() || undefined,
      email: draft.email.trim(),
      feeSharePercent: Number(draft.feeSharePercent) || 0,
      overseesTasks: draft.overseesTasks,
      active: true
    };

    const next = editingId ? roster.map((row) => (row.id === editingId ? entry : row)) : [...roster, entry];
    await persistRoster(next);
  }

  async function handleRemove(id: string) {
    const target = roster.find((row) => row.id === id);
    if (target && isManagingPartnerRosterEntry(target)) {
      onStatus("The managing / founding partner cannot be removed from the roster.", true);
      return;
    }
    await persistRoster(roster.filter((row) => row.id !== id));
  }

  const displayRoster = ensureManagingPartnerOnRoster(roster);

  return (
    <section className="staff-salary__panel staff-salary__panel--roster no-print">
      <div className="staff-salary__roster-head">
        <div>
          <p className="staff-salary__toolbar-label">Firm lawyers</p>
          <p className="staff-salary__toolbar-hint">
            Managing partner and associates for fee-sharing reports, task oversight, and client assignment dropdowns.
          </p>
        </div>
      </div>

      {displayRoster.length ? (
        <ul className="staff-salary__roster-list">
          {displayRoster.map((entry) => {
            const isPartner = isManagingPartnerRosterEntry(entry);
            return (
            <li
              key={entry.id}
              className={`staff-salary__roster-item${isPartner ? " staff-salary__roster-item--partner" : ""}`}
            >
              <div className="staff-salary__roster-item-main">
                {isPartner ? (
                  <>
                    <span className="staff-salary__roster-partner-badge">Managing / Founding Partner</span>
                    <strong>{entry.displayName}</strong>
                  </>
                ) : (
                  <>
                    <strong>{entry.displayName}</strong>
                    {entry.designation ? (
                      <div className="staff-salary__roster-item-role text-muted">{entry.designation}</div>
                    ) : null}
                  </>
                )}
                <div className="staff-salary__roster-item-meta text-muted">
                  {entry.email}
                  {" · "}
                  Fee share {entry.feeSharePercent}%
                  {entry.overseesTasks ? " · Oversees tasks" : " · Not on task roster"}
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
                {!isPartner ? (
                  <button
                    type="button"
                    className="staff-salary__btn staff-salary__btn--secondary"
                    disabled={busy || saving}
                    onClick={() => void handleRemove(entry.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="staff-salary__roster-empty text-muted">No lawyers on the roster yet. Add your first lawyer below.</p>
      )}

      <div className="staff-salary__roster-form">
        <p className="staff-salary__tool-block-label">{editingId ? "Edit lawyer" : "Add lawyer"}</p>
        <StaffSalaryFormGrid>
          <StaffSalaryField label="Lawyer name *">
            <input
              className="field"
              value={draft.displayName}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="Robert Hernandez"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Role / designation">
            <input
              className="field"
              value={draft.designation || ""}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, designation: e.target.value }))}
              placeholder="Founding / Managing Partner"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Email *">
            <input
              className="field"
              type="email"
              value={draft.email}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="counsel@hernandezlaw.info"
            />
          </StaffSalaryField>
          <StaffSalaryField label="Appearance fee share %">
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.feeSharePercent}
              disabled={busy || saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, feeSharePercent: Number(e.target.value) }))}
            />
          </StaffSalaryField>
        </StaffSalaryFormGrid>

        <label className="form-check staff-salary__roster-check">
          <input
            type="checkbox"
            checked={draft.overseesTasks}
            disabled={busy || saving}
            onChange={(e) => setDraft((prev) => ({ ...prev, overseesTasks: e.target.checked }))}
          />
          <span className="form-check__copy">
            Oversee tasks — add to Office Tasks Employees for assignments and court filing oversight
          </span>
        </label>

        <div className="staff-salary__roster-form-actions">
          <button
            type="button"
            className="staff-salary__btn staff-salary__btn--primary"
            disabled={busy || saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add lawyer"}
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
