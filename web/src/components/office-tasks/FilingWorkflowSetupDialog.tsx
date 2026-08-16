"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatDisplayDate, todayYmd } from "@/lib/office-tasks/date-only";
import { resolveFilingQueueRoute, type FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import {
  defaultInternalTaskDueDates,
  type FilingWorkflowSetupTaskDates
} from "@/lib/office-tasks/filing-workflow-setup-shared";
import {
  buildFilingWorkflowSetupCompleteView,
  type FilingWorkflowSetupCompleteView,
  type FilingWorkflowSetupSavedPayload
} from "@/lib/office-tasks/filing-workflow-success-view";
import { filingWorkflowStageLabel } from "@/lib/office-tasks/filing-workflow-setup-shared";
import type { FilingWorkflowStage } from "@/lib/office-tasks/filing-workflow-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { FILING_MODES, PLEADING_TYPES } from "@/lib/tasks-config";

type Props = {
  item: ItemSummary | OfficeItem;
  allItems?: OfficeItem[];
  open: boolean;
  busy?: boolean;
  roster?: string[];
  caseType?: string | null;
  onClose: () => void;
  onSaved?: (result: FilingWorkflowSetupSavedPayload) => void | Promise<void>;
  onViewWorkflow?: (eventId: string) => void;
  onGoToNextAction?: (eventId: string, actionKey: string) => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

const TASK_KEYS: Array<{ key: keyof FilingWorkflowSetupTaskDates; label: string }> = [
  { key: "drafting", label: "Draft pleading / submission" },
  { key: "review", label: "Review & Approval" },
  { key: "exhibits", label: "Prepare annexes and exhibits" },
  { key: "filing", label: "File" },
  { key: "serving", label: "Serve" },
  { key: "proof", label: "Upload proof of filing and service" }
];

type Phase = "form" | "saving" | "success";

export function FilingWorkflowSetupDialog({
  item,
  allItems = [],
  open,
  busy: busyProp,
  roster = [],
  caseType,
  onClose,
  onSaved,
  onViewWorkflow,
  onGoToNextAction,
  onStatus
}: Props) {
  useBodyScrollLock(open);
  const [phase, setPhase] = useState<Phase>("form");
  const [busy, setBusy] = useState(false);
  const [successView, setSuccessView] = useState<FilingWorkflowSetupCompleteView | null>(null);
  const originalDeadline = String(
    (item as OfficeItem).filingDeadline || item.date || ""
  ).trim();
  const today = todayYmd();
  const overdue = Boolean(originalDeadline && originalDeadline < today);

  const recommendation = useMemo(
    () =>
      resolveFilingQueueRoute({
        caseType,
        pleadingType: (item as OfficeItem).pleadingType,
        pleadingCaseNature: (item as OfficeItem).pleadingCaseNature
      }),
    [caseType, item]
  );

  const [pleadingType, setPleadingType] = useState("");
  const [filingMode, setFilingMode] = useState("");
  const [draftLinkMode, setDraftLinkMode] = useState<"none" | "url" | "note">("none");
  const [draftDocUrl, setDraftDocUrl] = useState("");
  const [draftDocNote, setDraftDocNote] = useState("");
  const [drafter, setDrafter] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [filingStaff, setFilingStaff] = useState("");
  const [serviceStaff, setServiceStaff] = useState("");
  const [confirmedQueue, setConfirmedQueue] = useState<FilingQueueKind>("e-filing");
  const [overrideReason, setOverrideReason] = useState("");
  const [dates, setDates] = useState<FilingWorkflowSetupTaskDates>(() =>
    defaultInternalTaskDueDates(originalDeadline, today)
  );
  const [generate, setGenerate] = useState<Record<keyof FilingWorkflowSetupTaskDates, boolean>>({
    drafting: true,
    review: true,
    exhibits: true,
    filing: true,
    serving: true,
    proof: true
  });

  useEffect(() => {
    if (!open) {
      setPhase("form");
      setSuccessView(null);
      setBusy(false);
      return;
    }
    const responsible = String(item.assignedTo || "").trim();
    setPleadingType(String((item as OfficeItem).pleadingType || "").trim());
    setFilingMode(String((item as OfficeItem).filingMode || "").trim());
    setDraftLinkMode("none");
    setDraftDocUrl("");
    setDraftDocNote("");
    setDrafter(responsible);
    setReviewer(responsible);
    setFilingStaff(responsible);
    setServiceStaff(responsible);
    setConfirmedQueue(recommendation.queue);
    setOverrideReason("");
    setDates(defaultInternalTaskDueDates(originalDeadline, todayYmd()));
    setGenerate({
      drafting: true,
      review: true,
      exhibits: true,
      filing: true,
      serving: true,
      proof: true
    });
  }, [open, item, originalDeadline, recommendation.queue]);

  useEffect(() => {
    if (phase !== "success" || !successView?.eventId) return;
    const refreshed = buildFilingWorkflowSetupCompleteView({
      eventId: successView.eventId,
      allItems,
      taskIds: successView.taskIds
    });
    if (refreshed) setSuccessView(refreshed);
  }, [allItems, phase, successView?.eventId, successView?.taskIds]);

  if (!open) return null;

  const staffOptions = roster.length ? roster : [item.assignedTo].filter(Boolean);
  const saving = busy || busyProp || phase === "saving";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || phase === "success") return;
    if (confirmedQueue !== recommendation.queue && !overrideReason.trim()) {
      onStatus?.("Override requires a reason (rule, order, or directive).", true);
      return;
    }
    setBusy(true);
    setPhase("saving");
    try {
      if (draftLinkMode === "url" && !draftDocUrl.trim()) {
        throw new Error("Paste a document URL, or choose “No link yet” / “Note instead.”");
      }
      if (draftLinkMode === "note" && !draftDocNote.trim()) {
        throw new Error("Enter a draft note, or choose “No link yet.”");
      }
      const res = await fetch("/api/tasks/items/filing-workflow-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: item.id,
          pleadingType,
          filingMode,
          draftDocUrl: draftLinkMode === "url" ? draftDocUrl.trim() : "",
          draftDocNote: draftLinkMode === "note" ? draftDocNote.trim() : "",
          drafter,
          reviewer,
          filingStaff,
          serviceStaff,
          taskDueDates: dates,
          recommendedQueue: recommendation.queue,
          confirmedQueue,
          overrideReason,
          generateTasks: generate
        })
      });
      const json = (await res.json().catch(() => ({}))) as FilingWorkflowSetupSavedPayload & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Setup failed.");

      const payload: FilingWorkflowSetupSavedPayload = {
        eventId: json.eventId || item.id,
        message: json.message,
        workflowStage: json.workflowStage,
        taskIds: json.taskIds
      };

      await onSaved?.(payload);

      const complete = buildFilingWorkflowSetupCompleteView({
        eventId: payload.eventId,
        allItems,
        taskIds: payload.taskIds
      });

      setSuccessView(
        complete || {
          eventId: payload.eventId,
          clientCase: item.clientCase || "—",
          legalDeadline: originalDeadline || "—",
          stages: TASK_KEYS.filter((row) => generate[row.key]).map((row) => ({
            key: row.key,
            label: row.label,
            taskId: payload.taskIds?.[row.key] || null,
            assignee: "—"
          })),
          nextActionLabel: "Start Drafting",
          nextActionKey: "start-drafting",
          workflowStageLabel: filingWorkflowStageLabel(
            (payload.workflowStage as FilingWorkflowStage) || "drafting"
          ),
          taskIds: payload.taskIds || {}
        }
      );
      setPhase("success");
      onStatus?.(json.message || "Filing workflow set up.");
    } catch (err) {
      setPhase("form");
      onStatus?.(err instanceof Error ? err.message : "Setup failed.", true);
    } finally {
      setBusy(false);
    }
  }

  const previewTasks = TASK_KEYS.filter((row) => generate[row.key]);

  if (phase === "success" && successView) {
    return (
      <ModalPortal>
        <div className="reset-dialog-backdrop no-print" role="presentation" onClick={onClose}>
          <div
            className="reset-dialog card max-w-2xl max-h-[min(90vh,100%)] overflow-y-auto overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filing-workflow-setup-complete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="view-eyebrow">Filing workflow</p>
            <h3 id="filing-workflow-setup-complete-title" className="font-display text-xl font-semibold text-ink">
              Filing Workflow Setup Complete
            </h3>
            <p className="mt-2 text-sm text-muted">
              The preparation stages and assignments have been created successfully.
            </p>
            <p className="mt-1 text-xs text-muted">
              {successView.clientCase} · Event {successView.eventId}
            </p>

            <ul className="mt-4 space-y-2 text-sm">
              {successView.stages.map((stage) => (
                <li
                  key={stage.key}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-line px-3 py-2"
                >
                  <span className="font-medium text-ink">{stage.label}</span>
                  <span className="text-muted">
                    {stage.taskId ? `${stage.taskId} · ${stage.assignee}` : "Not generated"}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm text-ink">
              <span className="text-muted">Workflow stage:</span>{" "}
              <strong>{successView.workflowStageLabel}</strong>
            </p>
            <p className="mt-1 text-sm text-ink">
              <span className="text-muted">Next action:</span>{" "}
              <strong>{successView.nextActionLabel}</strong>
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => onViewWorkflow?.(successView.eventId)}
              >
                View Workflow
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() =>
                  onGoToNextAction?.(successView.eventId, successView.nextActionKey)
                }
              >
                Go to Next Action
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <div
        className="reset-dialog-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filing-workflow-setup-title"
      >
        <div className="reset-dialog card max-w-2xl max-h-[min(90vh,100%)] overflow-y-auto overscroll-contain">
          <p className="view-eyebrow">Filing workflow</p>
          <h3 id="filing-workflow-setup-title" className="font-display text-xl font-semibold text-ink">
            Set Up Filing Workflow
          </h3>
          <p className="mt-2 text-sm text-muted">{item.clientCase || item.id}</p>
          <p className="mt-1 text-xs text-muted">Event ID · {item.id}</p>

          {phase === "saving" ? (
            <p className="mt-4 text-sm font-medium text-ink" role="status" aria-live="polite">
              Creating workflow and preparation tasks…
            </p>
          ) : null}

          <div className="mt-4 rounded-md border border-line bg-paper px-3 py-2 text-sm">
            <p className="font-medium text-ink">Legal deadline (unchanged)</p>
            <p className="text-ink">
              {originalDeadline ? formatDisplayDate(originalDeadline, "long") : "—"}
              {overdue ? (
                <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  Overdue
                </span>
              ) : null}
            </p>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <fieldset className="space-y-2" disabled={phase === "saving"}>
              <legend className="text-sm font-semibold text-ink">Pleading / submission</legend>
              <label className="form-field">
                <span className="form-field__label">Pleading type</span>
                <select
                  className="field-input"
                  value={pleadingType}
                  onChange={(e) => setPleadingType(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {PLEADING_TYPES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="form-field__label">Filing mode</span>
                <select
                  className="field-input"
                  value={filingMode}
                  onChange={(e) => setFilingMode(e.target.value)}
                >
                  <option value="">Select…</option>
                  {FILING_MODES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="space-y-2" disabled={phase === "saving"}>
              <legend className="text-sm font-semibold text-ink">Draft document</legend>
              <p className="text-xs text-muted">
                Optional. Paste a Google Drive / Docs link, leave blank for now, or note how
                the draft was shared (for example, email).
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Draft document option">
                {(
                  [
                    ["none", "No link yet"],
                    ["url", "Paste URL"],
                    ["note", "Note instead"]
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`event-segmented__pill${
                      draftLinkMode === value ? " event-segmented__pill--active" : ""
                    }`}
                    aria-pressed={draftLinkMode === value}
                    onClick={() => setDraftLinkMode(value)}
                  >
                    <span className="event-segmented__pill-text">{label}</span>
                  </button>
                ))}
              </div>

              {draftLinkMode === "url" ? (
                <label className="form-field">
                  <span className="form-field__label">Document URL</span>
                  <input
                    className="field-input"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://… (Google Drive or Google Docs)"
                    value={draftDocUrl}
                    onChange={(e) => setDraftDocUrl(e.target.value)}
                  />
                </label>
              ) : null}

              {draftLinkMode === "note" ? (
                <label className="form-field">
                  <span className="form-field__label">Draft note</span>
                  <input
                    className="field-input"
                    type="text"
                    maxLength={400}
                    placeholder="e.g. Draft already sent via email"
                    value={draftDocNote}
                    onChange={(e) => setDraftDocNote(e.target.value)}
                    list="fw-draft-note-presets"
                  />
                  <datalist id="fw-draft-note-presets">
                    <option value="Draft already sent via email" />
                    <option value="Hard copy only — no online link" />
                    <option value="Will attach Document URL later" />
                    <option value="Shared in WhatsApp / Messenger" />
                  </datalist>
                </label>
              ) : null}

              {draftLinkMode === "none" ? (
                <p className="text-xs text-muted">
                  Workflow will start without a linked draft. You can attach a URL later from Drafting.
                </p>
              ) : null}
            </fieldset>

            <fieldset className="grid gap-2 sm:grid-cols-2" disabled={phase === "saving"}>
              <legend className="col-span-full text-sm font-semibold text-ink">Staff</legend>
              {(
                [
                  ["drafter", "Drafter", drafter, setDrafter],
                  ["reviewer", "Reviewer", reviewer, setReviewer],
                  ["filingStaff", "Filing staff", filingStaff, setFilingStaff],
                  ["serviceStaff", "Service staff", serviceStaff, setServiceStaff]
                ] as const
              ).map(([id, label, value, setter]) => (
                <label key={id} className="form-field">
                  <span className="form-field__label">{label}</span>
                  <input
                    className="field-input"
                    list={`fw-staff-${id}`}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    required={id === "drafter" || id === "filingStaff"}
                  />
                  <datalist id={`fw-staff-${id}`}>
                    {staffOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2" disabled={phase === "saving"}>
              <legend className="text-sm font-semibold text-ink">Preparation tasks & internal due dates</legend>
              {TASK_KEYS.map(({ key, label }) => (
                <div key={key} className="flex flex-wrap items-center gap-2 rounded border border-line px-2 py-1.5">
                  <label className="flex flex-1 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={generate[key]}
                      onChange={(e) => setGenerate((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                  <input
                    type="date"
                    className="field-input w-auto"
                    value={dates[key]}
                    disabled={!generate[key]}
                    onChange={(e) => setDates((prev) => ({ ...prev, [key]: e.target.value }))}
                    required={generate[key]}
                  />
                </div>
              ))}
            </fieldset>

            <fieldset className="space-y-2" disabled={phase === "saving"}>
              <legend className="text-sm font-semibold text-ink">Filing method</legend>
              <p className="text-sm text-muted">{recommendation.reason}</p>
              <label className="form-field">
                <span className="form-field__label">Confirm method</span>
                <select
                  className="field-input"
                  value={confirmedQueue}
                  onChange={(e) => setConfirmedQueue(e.target.value as FilingQueueKind)}
                >
                  <option value="e-filing">E-filing</option>
                  <option value="physical">Personal / registered mail / courier</option>
                </select>
              </label>
              {confirmedQueue !== recommendation.queue ? (
                <label className="form-field">
                  <span className="form-field__label">Override reason *</span>
                  <input
                    className="field-input"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                  />
                </label>
              ) : null}
            </fieldset>

            <div className="rounded-md border border-line bg-cream/40 px-3 py-2 text-sm">
              <p className="font-semibold text-ink">Workflow preview</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                <li>Legal deadline stays {originalDeadline || "—"}</li>
                <li>{previewTasks.length} preparation task{previewTasks.length === 1 ? "" : "s"}</li>
                <li>Feed updates to the resolved next action after save</li>
              </ul>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary text-sm" disabled={saving}>
                {saving ? "Creating workflow…" : "Create workflow"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
