"use client";

import { useState } from "react";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import { EditItemDialog, type EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemMoreMenu } from "@/components/office-tasks/ItemMoreMenu";
import { ItemNextActionDialog } from "@/components/office-tasks/ItemNextActionDialog";
import { ItemFollowUpNoteDialog } from "@/components/office-tasks/ItemFollowUpNoteDialog";
import {
  buildItemDetailsSections,
  ItemDetailsDialog,
  shouldOfferReadAllDetails
} from "@/components/office-tasks/ItemDetailsDialog";
import { ItemResetDialog } from "@/components/office-tasks/ItemResetDialog";
import { ItemDeleteDialog } from "@/components/office-tasks/ItemDeleteDialog";
import { ClientCaseLink } from "@/components/office-tasks/ClientCodeBadge";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import {
  EventScheduleEmailDialog,
  canSendScheduleConfirmation
} from "@/components/office-tasks/EventScheduleEmailDialog";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isHearingPendingCourtConfirmation } from "@/lib/hearing-escalation";
import { normalizeOfficeStatus, formatDisplayDate } from "@/lib/office-tasks/date-only";
import {
  canAutoSendScheduleConfirmation,
  previewSavedEventScheduleRecipients,
  sendScheduleConfirmation
} from "@/lib/office-tasks/schedule-confirmation-client";
import { EventJoinLink } from "@/components/office-tasks/EventJoinLink";
import { EventPrepLinkNote } from "@/components/office-tasks/EventPrepLinkNote";
import { IntakeAdminTaskDialog } from "@/components/office-tasks/IntakeAdminTaskDialog";
import { BillingAdminTaskDialog } from "@/components/office-tasks/BillingAdminTaskDialog";
import { PrepChecklistBlock } from "@/components/office-tasks/PrepChecklistBlock";
import { matterItemAnchorId } from "@/lib/office-tasks/client-matter";
import { billingAdminTaskActionLabel, billingAdminTaskHint } from "@/lib/billing-admin-tasks";
import { needsFilingConfirmation } from "@/lib/office-tasks/filing-confirmation";
import { isEventFollowUpTask, resolveFollowUpParentEvent } from "@/lib/office-tasks/follow-up-event-actions";
import { displayRemarks } from "@/lib/office-tasks/follow-up-marker";
import {
  eventVenueDisplay,
  resolveEventJoinUrl,
  type EventScheduleEmailSentPatch
} from "@/lib/office-tasks/event-join-link";
import { isCancelledStatus, itemTone, myWorkItemKindLabel, todayYmd, truncate } from "@/lib/office-tasks/schedule";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import {
  intakeAdminTaskActionLabel,
  intakeAdminTaskHint,
  isIntakeConflictCheckTask,
  isIntakeConferenceTask,
  isIntakeEngagementDocumentTask
} from "@/lib/intake-admin-tasks";
import { useFirmAdmin } from "@/hooks/useFirmAdmin";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { prepChecklistIncompleteForItem } from "@/lib/office-tasks/prep-checklist-client";

type Props = {
  item: ItemSummary;
  allItems?: OfficeItem[];
  id?: string;
  className?: string;
  as?: "li" | "div";
  toggling?: boolean;
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
  onMarkSubmitted?: (item: ItemSummary) => void;
  onConfirmParentFiled?: (item: ItemSummary, parentEvent: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onItemStatus?: (message: string, isError?: boolean) => void;
  formOptions?: EntryFormOptions;
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
};

export function MyWorkListRow({
  item,
  allItems = [],
  id,
  className,
  as: Tag = "li",
  toggling,
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
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const tone = itemTone(item as OfficeItem, todayYmd());
  const kind = myWorkItemKindLabel(item);
  const prepBadge = prepChecklistIncompleteForItem(item, allItems);
  const status = normalizeOfficeStatus(item.status);
  const isDone = item.done || status === "Done" || status === "Submitted";
  const isCancelled = isCancelledStatus(status);
  const isStarted = status === "Started";
  const isWaiting = status === "Waiting";
  const showEdit = item.rowNumber >= 2 && Boolean(onSaveEdit && formOptions);
  const canAct =
    item.rowNumber >= 2 && (onToggleDone || onSetStatus || onResetWithDate || onUpdateNextAction || onDeleteItem);
  const showStatusActions =
    item.source === "Task" && onSetStatus && !isDone && !isCancelled;
  const showStartedBtn = showStatusActions && !isStarted;
  const showWaitingBtn = showStatusActions && !isWaiting;
  const showInProgressBtn = showStatusActions && (isStarted || isWaiting);
  const showCourtConfirmed =
    item.source === "Event" &&
    onCourtConfirmed &&
    isHearingPendingCourtConfirmation(item as OfficeItem) &&
    !isDone &&
    !isCancelled;
  const showScheduleEmail =
    canSendScheduleConfirmation(item) && !isDone && !isCancelled;
  const showMarkFiled =
    item.source === "Event" &&
    isAdmin &&
    onMarkSubmitted &&
    needsFilingConfirmation(item as OfficeItem, todayYmd()) &&
    !isDone &&
    !isCancelled;
  const showConfirmParentFiled =
    isAdmin &&
    followUpParent &&
    onConfirmParentFiled &&
    !isDone &&
    !isCancelled;
  const canToggleDone = Boolean(onToggleDone) && (item.source !== "Event" || isAdmin);

  const followUpNote = isStarted || isWaiting ? displayRemarks(taskRemarks) : "";
  const intakeHint = intakeAdminTaskHint(taskDescription);
  const billingHint = billingAdminAction ? billingAdminTaskHint(taskRemarks) : null;
  const workflowHint = intakeHint ?? billingHint;
  const detail = workflowHint ?? truncate(taskDescription || item.nextAction || "—", 120);
  const showReadAll = shouldOfferReadAllDetails({
    description: taskDescription,
    nextAction: item.nextAction || "",
    followUpNote,
    workflowHint
  });
  const detailsSections = buildItemDetailsSections({
    description: taskDescription,
    nextAction: item.nextAction || "",
    followUpNote,
    workflowHint
  });
  const joinUrl = item.source === "Event" ? resolveEventJoinUrl(item) : null;
  const venueDisplay = eventVenueDisplay(item.venue, joinUrl);
  const metaParts = [
    item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
      ? formatDisplayDate(item.date, "register")
      : item.date,
    item.startTime,
    venueDisplay ? `Venue: ${venueDisplay}` : "",
    item.assignedTo?.trim(),
    status !== "Open" ? status : ""
  ].filter(Boolean);
  const anchorId = id || matterItemAnchorId(item as OfficeItem);

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
      <Tag id={anchorId} className={`my-work-list__row my-work-list__row--${tone}${className ? ` ${className}` : ""}`}>
        <span className={`my-work-list__kind my-work-list__kind--${tone}`}>{kind}</span>
        {prepBadge ? <span className="my-work-list__prep-badge">{prepBadge}</span> : null}

        <div className="my-work-list__main">
          <div className="my-work-list__title-row">
            <ClientCaseLink clientCase={item.clientCase} className="my-work-list__client" />
            {item.priority ? <span className="my-work-list__priority">{item.priority}</span> : null}
          </div>
          <div className="my-work-list__detail-row">
            <p className="my-work-list__detail">{detail}</p>
            {showReadAll ? (
              <button
                type="button"
                className="my-work-list__read-all"
                onClick={() => setDetailsOpen(true)}
              >
                Read all
              </button>
            ) : null}
          </div>
          {metaParts.length > 0 ? <p className="my-work-list__meta">{metaParts.join(" · ")}</p> : null}
          {followUpNote ? <p className="my-work-list__follow-up-note">{followUpNote}</p> : null}
          <EventPrepLinkNote
            item={item as OfficeItem}
            allItems={allItems}
            viewerStaffName={viewerStaffName}
            viewerPrepRole={viewerPrepRole}
            roster={roster}
          />
          <EventJoinLink item={item} variant="list" />
          {onTogglePrepChecklistItem ? (
            <PrepChecklistBlock
              item={item}
              allItems={allItems}
              viewerStaffName={viewerStaffName}
              viewerPrepRole={viewerPrepRole}
              roster={roster}
              disabled={toggling || isDone || isCancelled}
              creating={prepChecklistCreating}
              collapsedDefault={false}
              surface="body"
              onTogglePrepChecklistItem={onTogglePrepChecklistItem}
              onMutatePrepChecklistItem={onMutatePrepChecklistItem}
            />
          ) : null}
        </div>

        <div className="my-work-list__bottom">
          {onCreatePrepChecklist || onInitializePrepChecklist ? (
            <div className="my-work-list__extras no-print">
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
              />
            </div>
          ) : null}

          <div className="my-work-list__actions">
          {showEdit ? (
            <button
              type="button"
              className="my-work-list__btn my-work-list__btn--ghost"
              disabled={toggling}
              onClick={() => setEditOpen(true)}
              aria-label="Edit"
            >
              Edit
            </button>
          ) : null}

          {(intakeEngagementTask || intakeConflictTask || intakeConferenceTask) && intakeAdminAction && !isDone && !isCancelled ? (
            <button
              type="button"
              className="my-work-list__btn my-work-list__btn--ghost"
              disabled={toggling}
              onClick={() => setIntakeAdminOpen(true)}
            >
              {intakeAdminAction}
            </button>
          ) : null}

          {billingAdminAction && !isDone && !isCancelled ? (
            <button
              type="button"
              className="my-work-list__btn my-work-list__btn--ghost"
              disabled={toggling}
              onClick={() => setBillingAdminOpen(true)}
            >
              {billingAdminAction}
            </button>
          ) : null}

          {canAct ? (
            isCancelled ? (
              onSetStatus || onDeleteItem ? (
                <>
                  {onSetStatus ? (
                    <button
                      type="button"
                      className="my-work-list__btn"
                      disabled={toggling}
                      onClick={() => onSetStatus(item, "restore")}
                    >
                      {toggling ? "…" : "Restore"}
                    </button>
                  ) : null}
                  {onDeleteItem ? (
                    <ItemMoreMenu toggling={toggling} onDelete={() => setDeleteOpen(true)} />
                  ) : null}
                </>
              ) : null
            ) : isDone ? (
              canToggleDone || onDeleteItem ? (
                <>
                  {canToggleDone ? (
                    <button
                      type="button"
                      className="my-work-list__btn"
                      disabled={toggling}
                      onClick={() => onToggleDone?.(item, false)}
                    >
                      {toggling ? "…" : "Reopen"}
                    </button>
                  ) : null}
                  {onDeleteItem ? (
                    <ItemMoreMenu toggling={toggling} onDelete={() => setDeleteOpen(true)} />
                  ) : null}
                </>
              ) : null
            ) : (
              <>
                {canToggleDone ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--done"
                    disabled={toggling}
                    onClick={() => onToggleDone?.(item, true)}
                  >
                    {toggling ? "…" : "Done"}
                  </button>
                ) : null}
                {showCourtConfirmed ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--ghost"
                    disabled={toggling}
                    onClick={() => onCourtConfirmed?.(item)}
                  >
                    Court OK
                  </button>
                ) : null}
                {showMarkFiled ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--ghost"
                    disabled={toggling}
                    onClick={() => onMarkSubmitted?.(item)}
                  >
                    Mark filed
                  </button>
                ) : null}
                {showConfirmParentFiled && followUpParent ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--ghost"
                    disabled={toggling}
                    onClick={() => onConfirmParentFiled?.(item, followUpParent as ItemSummary)}
                  >
                    Confirm filed
                  </button>
                ) : null}
                {showScheduleEmail ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--ghost"
                    disabled={toggling || scheduleSending}
                    onClick={() => void handleScheduleEmailClick()}
                  >
                    Email
                  </button>
                ) : null}
                {onUpdateNextAction ? (
                  <button
                    type="button"
                    className="my-work-list__btn my-work-list__btn--ghost"
                    disabled={toggling}
                    onClick={() => setNextActionOpen(true)}
                  >
                    Next
                  </button>
                ) : null}
                <ItemMoreMenu
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
        </div>
      </Tag>

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
      <ItemDetailsDialog
        item={item}
        open={detailsOpen}
        sections={detailsSections}
        metaLine={metaParts.join(" · ")}
        onClose={() => setDetailsOpen(false)}
      />
    </>
  );
}
