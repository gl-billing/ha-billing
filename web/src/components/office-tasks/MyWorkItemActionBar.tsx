"use client";

import { useState } from "react";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import { EditItemDialog, type EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemMoreMenu } from "@/components/office-tasks/ItemMoreMenu";
import { ItemNextActionDialog } from "@/components/office-tasks/ItemNextActionDialog";
import { ItemFollowUpNoteDialog } from "@/components/office-tasks/ItemFollowUpNoteDialog";
import { ItemResetDialog } from "@/components/office-tasks/ItemResetDialog";
import { ItemDeleteDialog } from "@/components/office-tasks/ItemDeleteDialog";
import {
  EventScheduleEmailDialog,
  canSendScheduleConfirmation
} from "@/components/office-tasks/EventScheduleEmailDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isHearingPendingCourtConfirmation } from "@/lib/hearing-escalation";
import { normalizeOfficeStatus } from "@/lib/office-tasks/date-only";
import {
  canAutoSendScheduleConfirmation,
  previewSavedEventScheduleRecipients,
  sendScheduleConfirmation
} from "@/lib/office-tasks/schedule-confirmation-client";
import { IntakeAdminTaskDialog } from "@/components/office-tasks/IntakeAdminTaskDialog";
import { BillingAdminTaskDialog } from "@/components/office-tasks/BillingAdminTaskDialog";
import { PrepChecklistBlock } from "@/components/office-tasks/PrepChecklistBlock";
import { billingAdminTaskActionLabel } from "@/lib/billing-admin-tasks";
import { needsFilingConfirmation } from "@/lib/office-tasks/filing-confirmation";
import { isEventFollowUpTask, resolveFollowUpParentEvent } from "@/lib/office-tasks/follow-up-event-actions";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import { isCancelledStatus, todayYmd } from "@/lib/office-tasks/schedule";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import {
  intakeAdminTaskActionLabel,
  isIntakeConflictCheckTask,
  isIntakeConferenceTask,
  isIntakeEngagementDocumentTask
} from "@/lib/intake-admin-tasks";
import { useFirmAdmin } from "@/hooks/useFirmAdmin";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";

function isChecklistActions(className?: string): boolean {
  return Boolean(className?.includes("my-work-checklist__actions"));
}

function workActionBtn(className: string | undefined, variant?: "ghost" | "accent" | "done") {
  if (isChecklistActions(className)) {
    return variant === "accent" || variant === "done" ? "my-work-cmd my-work-cmd--emphasis" : "my-work-cmd";
  }
  const parts = ["my-work-list__btn"];
  if (variant) parts.push(`my-work-list__btn--${variant}`);
  return parts.join(" ");
}

type Props = {
  item: ItemSummary;
  allItems?: OfficeItem[];
  className?: string;
  toggling?: boolean;
  hideDoneToggle?: boolean;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) => void;
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

export function MyWorkItemActionBar({
  item,
  allItems = [],
  className = "",
  toggling,
  hideDoneToggle = false,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
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
  const checklistActions = isChecklistActions(className);
  const isAdmin = useFirmAdmin();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [followUpNoteOpen, setFollowUpNoteOpen] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState<"Started" | "Waiting">("Waiting");
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleEmailOpen, setScheduleEmailOpen] = useState(false);
  const [scheduleSending, setScheduleSending] = useState(false);
  const [intakeAdminOpen, setIntakeAdminOpen] = useState(false);
  const [billingAdminOpen, setBillingAdminOpen] = useState(false);

  const taskDescription = item.details?.trim() || "";
  const taskRemarks = item.remarks?.trim() || "";
  const intakeEngagementTask = item.source === "Task" && isIntakeEngagementDocumentTask(taskDescription);
  const intakeConflictTask = item.source === "Task" && isIntakeConflictCheckTask(taskDescription);
  const intakeConferenceTask = item.source === "Task" && isIntakeConferenceTask(taskDescription);
  const intakeAdminAction = intakeAdminTaskActionLabel(taskDescription);
  const billingAdminAction = item.source === "Task" ? billingAdminTaskActionLabel(taskRemarks) : null;
  const followUpParent =
    item.source === "Task" && isEventFollowUpTask(item as OfficeItem)
      ? resolveFollowUpParentEvent(item as OfficeItem, allItems)
      : null;

  const status = normalizeOfficeStatus(item.status);
  const isDone = item.done || status === "Done" || status === "Submitted";
  const isCancelled = isCancelledStatus(status);
  const isStarted = status === "Started";
  const isWaiting = status === "Waiting";
  const showEdit = item.rowNumber >= 2 && Boolean(onSaveEdit && formOptions);
  const canAct =
    item.rowNumber >= 2 && (onToggleDone || onSetStatus || onResetWithDate || onUpdateNextAction || onDeleteItem);
  const showStatusActions = item.source === "Task" && onSetStatus && !isDone && !isCancelled;
  const showStartedBtn = showStatusActions && !isStarted;
  const showWaitingBtn = showStatusActions && !isWaiting;
  const showInProgressBtn = showStatusActions && (isStarted || isWaiting);
  const showCourtConfirmed =
    item.source === "Event" &&
    onCourtConfirmed &&
    isHearingPendingCourtConfirmation(item as OfficeItem) &&
    !isDone &&
    !isCancelled;
  const showScheduleEmail = canSendScheduleConfirmation(item) && !isDone && !isCancelled;
  const showMarkFiled =
    item.source === "Event" &&
    isAdmin &&
    onMarkSubmitted &&
    needsFilingConfirmation(item as OfficeItem, todayYmd()) &&
    !isDone &&
    !isCancelled;
  const showConfirmParentFiled =
    isAdmin && followUpParent && onConfirmParentFiled && !isDone && !isCancelled;
  const canToggleDone = Boolean(onToggleDone) && (item.source !== "Event" || isAdmin) && !hideDoneToggle;

  const hasToolbarExtras = Boolean(onCreatePrepChecklist || onInitializePrepChecklist);
  const hasActionButtons =
    showEdit ||
    ((intakeEngagementTask || intakeConflictTask || intakeConferenceTask) && intakeAdminAction && !isDone && !isCancelled) ||
    (billingAdminAction && !isDone && !isCancelled) ||
    canAct;

  if (!hasToolbarExtras && !hasActionButtons) return null;

  function openFollowUpNoteDialog(nextStatus: "Started" | "Waiting") {
    setFollowUpStatus(nextStatus);
    setFollowUpNoteOpen(true);
  }

  async function handleScheduleEmailClick() {
    if (toggling || scheduleSending || item.rowNumber < 2) return;
    setScheduleSending(true);
    try {
      const recipientEmails = await previewSavedEventScheduleRecipients({
        source: item.source,
        rowNumber: item.rowNumber,
        itemId: item.id
      });
      if (canAutoSendScheduleConfirmation(recipientEmails)) {
        const result = await sendScheduleConfirmation({
          source: item.source,
          rowNumber: item.rowNumber,
          itemId: item.id,
          recipientEmails,
          createMeetLink: item.platform === "Google Meet"
        });
        onItemStatus?.(result.message);
        onScheduleEmailSent?.({
          source: item.source,
          rowNumber: item.rowNumber,
          meetLink: result.meetLink,
          venue: result.venue,
          details: result.details
        });
        return;
      }
      setScheduleEmailOpen(true);
    } catch (error) {
      onItemStatus?.(error instanceof Error ? error.message : "Could not send schedule confirmation.", true);
    } finally {
      setScheduleSending(false);
    }
  }

  return (
    <>
      <div className={`my-work-item-actions no-print ${className}`.trim()}>
        <div className="my-work-item-actions__row">
          {hasToolbarExtras ? (
            <PrepChecklistBlock
              item={item}
              allItems={allItems}
              viewerStaffName={viewerStaffName}
              viewerPrepRole={viewerPrepRole}
              roster={roster}
              disabled={toggling || isDone || isCancelled}
              creating={prepChecklistCreating}
              surface="toolbar"
            onCreatePrepChecklist={onCreatePrepChecklist}
            onInitializePrepChecklist={onInitializePrepChecklist}
            compact={checklistActions}
          />
          ) : null}

          {hasActionButtons ? (
            <div
              className={`my-work-item-actions__buttons${checklistActions ? " my-work-item-actions__buttons--inline" : ""}`.trim()}
            >
            {showEdit ? (
              <button
                type="button"
                className={workActionBtn(className, "ghost")}
                disabled={toggling}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </button>
            ) : null}

            {(intakeEngagementTask || intakeConflictTask || intakeConferenceTask) &&
            intakeAdminAction &&
            !isDone &&
            !isCancelled ? (
              <button
                type="button"
                className={workActionBtn(className, "ghost")}
                disabled={toggling}
                onClick={() => setIntakeAdminOpen(true)}
              >
                {intakeAdminAction}
              </button>
            ) : null}

            {billingAdminAction && !isDone && !isCancelled ? (
              <button
                type="button"
                className={workActionBtn(className, "ghost")}
                disabled={toggling}
                onClick={() => setBillingAdminOpen(true)}
              >
                {billingAdminAction}
              </button>
            ) : null}

            {canAct ? (
              isCancelled ? (
                <>
                  {onSetStatus ? (
                    <button
                      type="button"
                      className={workActionBtn(className)}
                      disabled={toggling}
                      onClick={() => onSetStatus(item, "restore")}
                    >
                      {toggling ? "…" : "Restore"}
                    </button>
                  ) : null}
                  {onDeleteItem ? (
                    <ItemMoreMenu minimal={checklistActions} toggling={toggling} onDelete={() => setDeleteOpen(true)} />
                  ) : null}
                </>
              ) : isDone ? (
                <>
                  {canToggleDone ? (
                    <button
                      type="button"
                      className={workActionBtn(className)}
                      disabled={toggling}
                      onClick={() => onToggleDone?.(item, false)}
                    >
                      {toggling ? "…" : "Reopen"}
                    </button>
                  ) : null}
                  {onDeleteItem ? (
                    <ItemMoreMenu minimal={checklistActions} toggling={toggling} onDelete={() => setDeleteOpen(true)} />
                  ) : null}
                </>
              ) : (
                <>
                  {canToggleDone ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "done")}
                      disabled={toggling}
                      onClick={() => onToggleDone?.(item, true)}
                    >
                      {toggling ? "…" : "Done"}
                    </button>
                  ) : null}
                  {showCourtConfirmed ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "ghost")}
                      disabled={toggling}
                      onClick={() => onCourtConfirmed?.(item)}
                    >
                      Court OK
                    </button>
                  ) : null}
                  {showMarkFiled ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "ghost")}
                      disabled={toggling}
                      onClick={() => onMarkSubmitted?.(item)}
                    >
                      Filed
                    </button>
                  ) : null}
                  {showConfirmParentFiled && followUpParent ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "ghost")}
                      disabled={toggling}
                      onClick={() => onConfirmParentFiled?.(item, followUpParent as ItemSummary)}
                    >
                      Confirm
                    </button>
                  ) : null}
                  {showScheduleEmail ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "ghost")}
                      disabled={toggling || scheduleSending}
                      onClick={() => void handleScheduleEmailClick()}
                    >
                      Email
                    </button>
                  ) : null}
                  {onUpdateNextAction ? (
                    <button
                      type="button"
                      className={workActionBtn(className, "ghost")}
                      disabled={toggling}
                      onClick={() => setNextActionOpen(true)}
                    >
                      Next
                    </button>
                  ) : null}
                  <ItemMoreMenu
                    minimal={checklistActions}
                    toggling={toggling}
                    showStarted={showStartedBtn}
                    onStarted={onSetStatus ? () => openFollowUpNoteDialog("Started") : undefined}
                    showWaiting={showWaitingBtn}
                    onWaiting={onSetStatus ? () => openFollowUpNoteDialog("Waiting") : undefined}
                    showInProgress={showInProgressBtn}
                    onInProgress={onSetStatus ? () => onSetStatus(item, "In Progress") : undefined}
                    onCancel={onSetStatus ? () => onSetStatus(item, "Cancelled") : undefined}
                    onReset={onResetWithDate ? () => setResetOpen(true) : undefined}
                    onDelete={onDeleteItem ? () => setDeleteOpen(true) : undefined}
                  />
                </>
              )
            ) : null}
          </div>
        ) : null}
        </div>
      </div>

      {onResetWithDate ? (
        <ItemResetDialog
          item={item}
          open={resetOpen}
          busy={toggling}
          onClose={() => setResetOpen(false)}
          onConfirm={(target, newDate) => {
            onResetWithDate(target, newDate);
            setResetOpen(false);
          }}
        />
      ) : null}
      {onDeleteItem ? (
        <ItemDeleteDialog
          item={item}
          open={deleteOpen}
          busy={toggling}
          onClose={() => setDeleteOpen(false)}
          onConfirm={(target) => {
            onDeleteItem(target);
            setDeleteOpen(false);
          }}
        />
      ) : null}
      {onUpdateNextAction ? (
        <ItemNextActionDialog
          item={item}
          open={nextActionOpen}
          busy={toggling}
          onClose={() => setNextActionOpen(false)}
          onConfirm={(target, nextAction) => {
            onUpdateNextAction(target, nextAction);
            setNextActionOpen(false);
          }}
        />
      ) : null}
      {onSetStatus ? (
        <ItemFollowUpNoteDialog
          item={item}
          status={followUpStatus}
          open={followUpNoteOpen}
          busy={toggling}
          onClose={() => setFollowUpNoteOpen(false)}
          onConfirm={(target, nextStatus, note) => {
            onSetStatus(target, nextStatus, { note });
            setFollowUpNoteOpen(false);
          }}
        />
      ) : null}
      {onSaveEdit && formOptions ? (
        <EditItemDialog
          item={item as EditableItem}
          options={formOptions}
          open={editOpen}
          busy={toggling}
          onClose={() => setEditOpen(false)}
          onConfirm={(target, payload) => {
            onSaveEdit(target, payload);
            setEditOpen(false);
          }}
        />
      ) : null}
      <EventScheduleEmailDialog
        open={scheduleEmailOpen}
        item={item}
        busy={toggling || scheduleSending}
        onClose={() => setScheduleEmailOpen(false)}
        onSent={onScheduleEmailSent}
        onStatus={onItemStatus}
      />
      {intakeAdminAction ? (
        <IntakeAdminTaskDialog
          item={item}
          open={intakeAdminOpen}
          busy={toggling}
          onClose={() => setIntakeAdminOpen(false)}
          onStatus={onItemStatus}
          onComplete={onToggleDone ? () => onToggleDone(item, true) : undefined}
        />
      ) : null}
      {billingAdminAction ? (
        <BillingAdminTaskDialog
          item={item}
          open={billingAdminOpen}
          busy={toggling}
          onClose={() => setBillingAdminOpen(false)}
          onStatus={onItemStatus}
          onComplete={onToggleDone ? () => onToggleDone(item, true) : undefined}
        />
      ) : null}
    </>
  );
}
