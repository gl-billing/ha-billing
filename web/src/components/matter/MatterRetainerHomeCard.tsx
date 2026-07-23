"use client";

import { formatPeso } from "@/lib/gl-config";
import {
  buildRetainerHomeReadiness,
  formatRetainerDirectoryLabel,
  mergeRetainerPackage,
  suggestedRetainerHomeCode,
  summarizePackageCoverage,
  type RetainerHomeReadiness
} from "@/lib/retainer-package";
import type { ClientDetail } from "@/lib/gl-config";
import {
  describeCurrentRetainerMonth,
  type RetainerMonthCell
} from "@/lib/retainer-month-ops";
import { parseIntakePathDetails, serializeIntakePathDetails } from "@/lib/intake-path-workflows";
import { parseApiJson } from "@/lib/parse-api-response";
import { ClientCodeRenameForm } from "@/components/ClientCodeRenameForm";
import { useMemo, useState } from "react";

type Props = {
  clientDetail: ClientDetail;
  lastChargeLabel?: string | null;
  lastSoaLabel?: string | null;
  monthRibbon?: RetainerMonthCell[];
  canRename?: boolean;
  canEdit?: boolean;
  onRenamed?: (newCode: string) => void;
  onSaved?: () => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`matter-retainer-home__dot${ok ? " matter-retainer-home__dot--ok" : " matter-retainer-home__dot--warn"}`}
      aria-hidden
    />
  );
}

function ribbonTone(cell: RetainerMonthCell): string {
  if (cell.late) return "late";
  if (cell.paid) return "paid";
  if (cell.posted) return "posted";
  return "empty";
}

function ribbonAria(cell: RetainerMonthCell): string {
  if (cell.late) return `${cell.label}: late`;
  if (cell.paid) return `${cell.label}: paid`;
  if (cell.posted) return `${cell.label}: posted${cell.emailed ? ", emailed" : ""}`;
  return `${cell.label}: not billed`;
}

export function MatterRetainerHomeCard({
  clientDetail,
  lastChargeLabel,
  lastSoaLabel,
  monthRibbon,
  canRename,
  canEdit = true,
  onRenamed,
  onSaved,
  onStatus
}: Props) {
  const readiness = useMemo(() => buildRetainerHomeReadiness(clientDetail), [clientDetail]);
  const [showRename, setShowRename] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("");
  const [dueDraft, setDueDraft] = useState("");
  const [savingFee, setSavingFee] = useState(false);

  if (!readiness) return null;

  const suggested = suggestedRetainerHomeCode(clientDetail.code, clientDetail.name);
  const title = formatRetainerDirectoryLabel(clientDetail.code, clientDetail.name);
  const ribbonStory = monthRibbon?.length ? describeCurrentRetainerMonth(monthRibbon) : "";

  function startEditFee() {
    setFeeDraft(readiness!.feeOk ? String(readiness!.fee) : "");
    setDueDraft(readiness!.dueDayOk ? String(readiness!.dueDay) : "");
    setEditingFee(true);
    setShowRename(false);
  }

  async function saveFee() {
    const feeNum = Number(String(feeDraft).replace(/,/g, ""));
    const dueNum = Math.floor(Number(dueDraft));
    if (!Number.isFinite(feeNum) || feeNum <= 0) {
      onStatus?.("Enter a monthly fee greater than zero.", true);
      return;
    }
    if (!Number.isFinite(dueNum) || dueNum < 1 || dueNum > 28) {
      onStatus?.("Due day must be between 1 and 28.", true);
      return;
    }

    const existing = parseIntakePathDetails(clientDetail.intakePathDetails) || { path: "retainer" as const };
    const retainer = { ...(existing.retainer || {}) };
    retainer.retainerFee = String(feeNum);
    retainer.dueDay = String(dueNum);
    retainer.billingCycle = retainer.billingCycle || "monthly";
    retainer.package = mergeRetainerPackage(retainer, clientDetail.code);

    setSavingFee(true);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(clientDetail.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterType: "retainer",
          retainerDueDay: String(dueNum),
          intakePathDetails: serializeIntakePathDetails({
            ...existing,
            path: "retainer",
            retainer
          })
        })
      });
      const { ok, data, errorMessage } = await parseApiJson<{ message?: string }>(response);
      if (!ok) throw new Error(errorMessage || "Could not save fee.");
      onStatus?.(data.message || "Monthly fee and due day saved.");
      setEditingFee(false);
      await onSaved?.();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not save fee.", true);
    } finally {
      setSavingFee(false);
    }
  }

  return (
    <section className="matter-retainer-home no-print" aria-label="Retainer home">
      <div className="matter-retainer-home__head">
        <div>
          <p className="matter-retainer-home__eyebrow">Retainer home</p>
          <h2 className="matter-retainer-home__title">{title}</h2>
          <p className="matter-retainer-home__sub">
            {readiness.ready
              ? "Ready for automatic monthly billing and statement email."
              : `Finish setup: ${readiness.missing.join(", ")}.`}
          </p>
        </div>
        <span
          className={`matter-retainer-home__badge${
            readiness.ready ? " matter-retainer-home__badge--ready" : " matter-retainer-home__badge--warn"
          }`}
        >
          {readiness.ready ? "Ready" : "Needs setup"}
        </span>
      </div>

      <ul className="matter-retainer-home__checklist">
        <CheckRow
          ok={readiness.feeOk}
          label="Monthly fee"
          value={readiness.feeOk ? formatPeso(readiness.fee) : "Not set"}
        />
        <CheckRow
          ok={readiness.dueDayOk}
          label="Due day"
          value={readiness.dueDayOk ? `Day ${readiness.dueDay}` : "Not set"}
        />
        <CheckRow
          ok={readiness.emailOk}
          label="Master contact email"
          value={readiness.emailOk ? readiness.email : "Add Master List contact email"}
        />
        <CheckRow
          ok={readiness.autoBilling}
          label="Auto-post fee"
          value={readiness.autoBilling ? "On" : "Off"}
        />
        <CheckRow
          ok={readiness.autoSoa}
          label="Auto-email statement"
          value={readiness.autoSoa ? "On" : "Off"}
        />
        <CheckRow
          ok={Boolean(lastChargeLabel)}
          label="Last retainer charge"
          value={lastChargeLabel || "None yet"}
        />
        <CheckRow
          ok={Boolean(lastSoaLabel)}
          label="Last statement sent"
          value={lastSoaLabel || "None yet"}
        />
      </ul>

      {monthRibbon?.length ? (
        <div className="matter-retainer-home__ribbon" aria-label="12-month retainer history">
          <p className="matter-retainer-home__package-label">12-month ribbon</p>
          <ul className="matter-retainer-home__ribbon-list">
            {monthRibbon.map((cell) => (
              <li
                key={cell.periodKey}
                className={`matter-retainer-home__ribbon-cell matter-retainer-home__ribbon-cell--${ribbonTone(cell)}`}
                title={ribbonAria(cell)}
                aria-label={ribbonAria(cell)}
              >
                <span className="matter-retainer-home__ribbon-month">{cell.label}</span>
                <span className="matter-retainer-home__ribbon-tone" aria-hidden>
                  {cell.late ? "Late" : cell.paid ? "Paid" : cell.posted ? "Due" : "—"}
                </span>
              </li>
            ))}
          </ul>
          {ribbonStory ? (
            <p className="matter-retainer-home__ribbon-story">{ribbonStory}</p>
          ) : null}
        </div>
      ) : null}

      <div className="matter-retainer-home__package">
        <p className="matter-retainer-home__package-label">Package</p>
        <p className="matter-retainer-home__package-copy">
          {readiness.package.packageNotes || summarizePackageCoverage(readiness.package) || "—"}
        </p>
        {readiness.nextBillingDate ? (
          <p className="matter-retainer-home__next">
            Next billing <strong>{readiness.nextBillingDate}</strong>
            {readiness.feeOk ? ` · ${formatPeso(readiness.fee)}` : ""}
          </p>
        ) : null}
      </div>

      {editingFee ? (
        <div className="matter-retainer-home__fee-edit" id="matter-retainer-fee-settings">
          <p className="matter-retainer-home__package-label">Edit fee & due day</p>
          <div className="matter-retainer-home__fee-grid">
            <label className="matter-retainer-home__fee-field">
              <span>Monthly fee (₱)</span>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={feeDraft}
                disabled={savingFee}
                onChange={(e) => setFeeDraft(e.target.value)}
              />
            </label>
            <label className="matter-retainer-home__fee-field">
              <span>Due day (1–28)</span>
              <input
                className="field"
                type="number"
                min={1}
                max={28}
                value={dueDraft}
                disabled={savingFee}
                onChange={(e) => setDueDraft(e.target.value)}
              />
            </label>
          </div>
          <div className="matter-retainer-home__actions">
            <button type="button" className="btn-gold text-xs" disabled={savingFee} onClick={() => void saveFee()}>
              {savingFee ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={savingFee}
              onClick={() => setEditingFee(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="matter-retainer-home__actions">
          {canEdit ? (
            <button type="button" className="btn-secondary text-xs" onClick={startEditFee}>
              Edit fee & due day →
            </button>
          ) : null}
          {suggested && canRename ? (
            <button type="button" className="btn-gold text-xs" onClick={() => setShowRename((v) => !v)}>
              {showRename ? "Hide rename" : `Rename to ${suggested}`}
            </button>
          ) : null}
        </div>
      )}

      {showRename && suggested && canRename ? (
        <div className="matter-retainer-home__rename">
          <p className="text-xs text-muted mb-2">
            Align this retainer with Fusion/Logic using <strong>{suggested}</strong>. Sibling matters
            (IQBAL-2, IQBAL-3) stay as case files under the family.
          </p>
          <ClientCodeRenameForm
            currentCode={clientDetail.code}
            busy={false}
            compact
            onBusy={() => undefined}
            onStatus={(message, isError) => onStatus?.(message, isError)}
            onRenamed={(newCode) => {
              setShowRename(false);
              onRenamed?.(newCode);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

function CheckRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="matter-retainer-home__row">
      <StatusDot ok={ok} />
      <span className="matter-retainer-home__row-label">{label}</span>
      <span className="matter-retainer-home__row-value">{value}</span>
    </li>
  );
}

export type { RetainerHomeReadiness };
