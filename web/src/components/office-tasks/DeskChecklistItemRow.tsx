"use client";

import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { MyWorkListRow } from "@/components/office-tasks/MyWorkListRow";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { deskChecklistItemTitle } from "@/lib/office-tasks/desk-checklist";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import { isPrepReadyTask } from "@/lib/office-tasks/prep-completion-core";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { DeskChecklistRowOptions } from "@/lib/office-tasks/checklist-row-state";

export type DeskChecklistItemRowProps = {
  item: OfficeItem;
  id?: string;
  className?: string;
  allItems: OfficeItem[];
  togglingKey?: string | null;
  prepChecklistCreatingKey?: string | null;
  canToggleItems?: boolean;
  options?: DeskChecklistRowOptions;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onMarkPrepDone?: (item: ItemSummary) => void;
  onMarkLetterDocDone?: (item: ItemSummary) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onLogAppearanceOutcome?: (
    item: ItemSummary,
    payload: {
      action: "completed" | "rescheduled" | "postponed" | "cancelled";
      whatHappened: string;
      nextDate?: string;
      createNextDateFollowUp: boolean;
      courtFollowUpKind?: "none" | "next_hearing" | "submission" | "other";
      followUpDate?: string;
      followUpNote?: string;
    }
  ) => void | Promise<void>;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onItemStatus?: (message: string, isError?: boolean) => void;
  formOptions?: EntryFormOptions;
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
  billingAccess?: boolean;
  ledgerEntries?: import("@/lib/gl-config").LedgerEntry[];
} & WorkItemFilingActionProps;

export function DeskChecklistItemRow({
  item,
  id,
  className,
  allItems,
  togglingKey,
  prepChecklistCreatingKey,
  canToggleItems = true,
  options = {},
  onToggleDone,
  onMarkPrepDone,
  onMarkLetterDocDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onLogAppearanceOutcome,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onScheduleEmailSent,
  onItemStatus,
  formOptions,
  viewerStaffName,
  viewerPrepRole,
  roster = [],
  billingAccess,
  ledgerEntries
}: DeskChecklistItemRowProps) {
  const key = officeItemKey(item);
  const busy = togglingKey === key;
  const muted = options.muted ?? false;
  const inactive = options.inactive ?? false;
  const prepReady = !inactive && isPrepReadyTask(item);
  // Never force checked from section chrome — completed rows used options.checked=true which
  // blocked reopening (controlled checkbox snapped back on uncheck).
  const checked = options.inactive ? false : item.done || prepReady;

  return (
    <li
      id={id}
      className={`desk-checklist-row${prepReady ? " desk-checklist-row--prep-ready" : ""}${muted ? " desk-checklist-row--muted" : ""}${
        inactive ? " desk-checklist-row--inactive" : ""
      }${className ? ` ${className}` : ""}`}
    >
      <input
        type="checkbox"
        className={`desk-checklist-row__check${
          inactive ? " desk-checklist-row__check--inactive" : muted ? " desk-checklist-row__check--muted" : ""
        }`}
        checked={checked}
        disabled={busy || !canToggleItems || !onToggleDone}
        aria-label={
          inactive
            ? `${deskChecklistItemTitle(item)} — cancelled or postponed`
            : prepReady
              ? `Reopen prep for ${deskChecklistItemTitle(item)}`
              : checked
                ? `Reopen ${deskChecklistItemTitle(item)}`
                : `Mark ${deskChecklistItemTitle(item)} done`
        }
        title={
          prepReady
            ? "Uncheck to reopen prep and continue working on the checklist."
            : undefined
        }
        onChange={(event) => {
          event.stopPropagation();
          onToggleDone?.(item, event.target.checked);
        }}
      />
      <MyWorkListRow
        as="div"
        item={item}
        allItems={allItems}
        toggling={busy}
        onToggleDone={canToggleItems ? onToggleDone : undefined}
        onSetStatus={onSetStatus}
        onResetWithDate={onResetWithDate}
        onDeleteItem={onDeleteItem}
        onUpdateNextAction={onUpdateNextAction}
        onLogAppearanceOutcome={onLogAppearanceOutcome}
        onTogglePrepChecklistItem={onTogglePrepChecklistItem}
        onMutatePrepChecklistItem={onMutatePrepChecklistItem}
        onCreatePrepChecklist={onCreatePrepChecklist}
        onInitializePrepChecklist={onInitializePrepChecklist}
        prepChecklistCreating={prepChecklistCreatingKey === key}
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
    </li>
  );
}
