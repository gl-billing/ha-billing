"use client";

import { ClientCaseLink } from "@/components/office-tasks/ClientCodeBadge";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { MyWorkItemActionBar } from "@/components/office-tasks/MyWorkItemActionBar";
import { parseClientCaseDisplay } from "@/lib/office-tasks/client-matter";
import {
  daysBetweenYmd,
  formatDisplayDate,
  normalizeOfficeStatus,
  todayYmd
} from "@/lib/office-tasks/date-only";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import { myWorkItemKindLabel } from "@/lib/office-tasks/schedule";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import { isHearingPendingCourtConfirmation } from "@/lib/hearing-escalation";
import { needsFilingConfirmation } from "@/lib/office-tasks/filing-confirmation";

type Props = {
  item: ItemSummary;
  allItems?: OfficeItem[];
  toggling?: boolean;
  isAdmin?: boolean;
  showOverdueSince?: boolean;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreating?: boolean;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onItemStatus?: (message: string, isError?: boolean) => void;
  formOptions?: EntryFormOptions;
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
} & WorkItemFilingActionProps;

function formatDueLabel(date: string | null | undefined): string {
  if (!date) return "—";
  return formatDisplayDate(date, "short");
}

function overdueSinceLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const today = todayYmd();
  if (date >= today) return null;
  const days = daysBetweenYmd(date, today);
  if (days <= 0) return null;
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

export function MyWorkChecklistRow({
  item,
  allItems = [],
  toggling,
  isAdmin = false,
  showOverdueSince = false,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreating,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onScheduleEmailSent,
  onItemStatus,
  formOptions,
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: Props) {
  const display = parseClientCaseDisplay(item.clientCase);
  const caseTitle = display.subtitle?.trim() || display.title;
  const clientName = display.subtitle?.trim() ? display.title : null;
  const status = normalizeOfficeStatus(item.status);
  const isDone = item.done || status === "Done" || status === "Submitted";
  const canToggle =
    Boolean(onToggleDone) &&
    item.rowNumber >= 2 &&
    (item.source === "Task" || isAdmin);
  const overdueLabel = showOverdueSince ? overdueSinceLabel(item.date) : null;
  const kind = myWorkItemKindLabel(item);
  const assigned = item.assignedTo?.trim() || "Unassigned";

  const showCourtConfirmed =
    item.source === "Event" &&
    onCourtConfirmed &&
    isHearingPendingCourtConfirmation(item as OfficeItem) &&
    !isDone &&
    status !== "Cancelled";
  const showMarkFiled =
    item.source === "Event" &&
    isAdmin &&
    onMarkSubmitted &&
    needsFilingConfirmation(item as OfficeItem, todayYmd()) &&
    !isDone &&
    status !== "Cancelled";

  const mobileTapAction = showCourtConfirmed
    ? { label: "Court OK", onClick: () => onCourtConfirmed?.(item) }
    : showMarkFiled
      ? { label: "Filed", onClick: () => onMarkSubmitted?.(item) }
      : canToggle && !isDone
        ? { label: "Done", onClick: () => onToggleDone?.(item, true) }
        : null;

  return (
    <li
      className={`my-work-checklist__row${isDone ? " my-work-checklist__row--done" : ""}${showOverdueSince && overdueLabel ? " my-work-checklist__row--overdue" : ""}`}
    >
      <label className="my-work-checklist__check-wrap">
        <input
          type="checkbox"
          className="my-work-checklist__check"
          checked={isDone}
          disabled={!canToggle || toggling}
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
          onChange={() => onToggleDone?.(item, !isDone)}
        />
        <span className="my-work-checklist__check-ui" aria-hidden />
      </label>

      <div className="my-work-checklist__content">
        <div className="my-work-checklist__body">
          <div className="my-work-checklist__primary">
            <div className="my-work-checklist__headline">
              <span className="my-work-checklist__kind">{kind}</span>
              <span className="my-work-checklist__sep" aria-hidden>
                ·
              </span>
              <span className="my-work-checklist__case">{caseTitle}</span>
              {clientName ? (
                <>
                  <span className="my-work-checklist__sep my-work-checklist__sep--em" aria-hidden>
                    —
                  </span>
                  <ClientCaseLink clientCase={item.clientCase} className="my-work-checklist__client">
                    {clientName}
                  </ClientCaseLink>
                </>
              ) : null}
            </div>

            <MyWorkItemActionBar
              className="my-work-checklist__actions"
              item={item}
              allItems={allItems}
              toggling={toggling}
              hideDoneToggle
              onToggleDone={onToggleDone}
              onSetStatus={onSetStatus}
              onResetWithDate={onResetWithDate}
              onDeleteItem={onDeleteItem}
              onUpdateNextAction={onUpdateNextAction}
              onCreatePrepChecklist={onCreatePrepChecklist}
              onInitializePrepChecklist={onInitializePrepChecklist}
              prepChecklistCreating={prepChecklistCreating}
              onSaveEdit={onSaveEdit}
              onCourtConfirmed={onCourtConfirmed}
              onMarkSubmitted={onMarkSubmitted}
              onConfirmParentFiled={onConfirmParentFiled}
              onScheduleEmailSent={onScheduleEmailSent}
              onItemStatus={onItemStatus}
              formOptions={formOptions}
              viewerStaffName={viewerStaffName}
              viewerPrepRole={viewerPrepRole}
              roster={roster}
            />
          </div>

          {mobileTapAction ? (
            <div className="my-work-checklist__tap-bar no-print">
              <button
                type="button"
                className="my-work-checklist__tap-btn"
                disabled={toggling}
                onClick={mobileTapAction.onClick}
              >
                {toggling ? "…" : mobileTapAction.label}
              </button>
            </div>
          ) : null}

          <dl className="my-work-checklist__meta">
            <div>
              <dt>Assigned</dt>
              <dd>{assigned}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatDueLabel(item.date)}</dd>
            </div>
            {item.startTime ? (
              <div>
                <dt>Time</dt>
                <dd>{item.startTime}</dd>
              </div>
            ) : null}
            {overdueLabel ? (
              <div>
                <dt>Overdue</dt>
                <dd>{overdueLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </li>
  );
}
