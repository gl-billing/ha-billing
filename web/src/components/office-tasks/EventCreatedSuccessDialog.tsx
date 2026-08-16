"use client";

import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { EventCreatedSuccessView } from "@/lib/office-tasks/filing-workflow-success-view";

type Props = {
  open: boolean;
  view: EventCreatedSuccessView | null;
  onClose: () => void;
  onSetUpWorkflow: () => void;
  onViewEvent: () => void;
};

export function EventCreatedSuccessDialog({
  open,
  view,
  onClose,
  onSetUpWorkflow,
  onViewEvent
}: Props) {
  useBodyScrollLock(open);
  if (!open || !view) return null;

  const needsWorkflowSetup =
    view.workflowSetupStatus === "Not set up" ||
    view.workflowSetupStatus === "Incomplete" ||
    view.workflowSetupStatus === "Setup still required";

  return (
    <ModalPortal>
      <div className="reset-dialog-backdrop no-print" role="presentation" onClick={onClose}>
        <div
          className="reset-dialog card max-w-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-created-success-title"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="view-eyebrow">Filing deadline</p>
          <h3 id="event-created-success-title" className="font-display text-xl font-semibold text-ink">
            {view.title}
          </h3>

          <dl className="mt-4 space-y-2 text-sm">
            <SuccessRow label="Event type" value={view.eventType} />
            <SuccessRow label="Case / client" value={view.clientCase} />
            <SuccessRow label="Legal deadline" value={view.legalDeadlineDisplay} />
            <SuccessRow label="Responsible lawyer" value={view.responsible} />
            <SuccessRow label="Event status" value={view.eventStatus} />
            <SuccessRow label="Calendar" value={view.calendarStatus} />
            <SuccessRow label="Workflow setup" value={view.workflowSetupStatus} />
            {view.workflowStageLabel ? (
              <SuccessRow label="Current workflow stage" value={view.workflowStageLabel} />
            ) : null}
            {view.nextActionLabel ? <SuccessRow label="Next action" value={view.nextActionLabel} /> : null}
          </dl>

          {needsWorkflowSetup ? (
            <p className="mt-4 text-sm text-muted">
              Filing workflow has not yet been set up.
              {view.prepTasksRequested
                ? " Complete setup to assign Drafting → Proof stages and due dates."
                : " Set it up now to schedule each preparation stage."}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {needsWorkflowSetup ? (
              <button type="button" className="btn-primary text-sm" onClick={onSetUpWorkflow}>
                Set Up Filing Workflow
              </button>
            ) : null}
            <button type="button" className="btn-secondary text-sm" onClick={onViewEvent}>
              View Event
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function SuccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
