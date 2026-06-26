"use client";

import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { MyWorkListRow } from "@/components/office-tasks/MyWorkListRow";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";

export type ItemSummary = Pick<
  OfficeItem,
  | "source"
  | "id"
  | "date"
  | "eventDate"
  | "filingDeadline"
  | "clientCase"
  | "assignedTo"
  | "category"
  | "priority"
  | "status"
  | "details"
  | "nextAction"
  | "venue"
  | "startTime"
  | "done"
  | "rowNumber"
  | "remarks"
  | "reminderDays"
  | "calendarSync"
  | "platform"
  | "filingMode"
  | "pleadingType"
  | "pleadingCaseNature"
  | "receivedDate"
  | "periodToFileDays"
  | "filingDate"
>;

type Props = {
  item: ItemSummary;
  allItems?: OfficeItem[];
  id?: string;
  className?: string;
  compact?: boolean;
  /** @deprecated Same layout as default — kept for callers */
  variant?: "default" | "day-detail";
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
  viewerStaffName?: string;
  viewerPrepRole?: import("@/lib/office-tasks/prep-workload-view").PrepWorkloadViewRole;
  roster?: string[];
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  onMarkSubmitted?: (item: ItemSummary) => void;
  onConfirmParentFiled?: (item: ItemSummary, parentEvent: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onItemStatus?: (message: string, isError?: boolean) => void;
  formOptions?: EntryFormOptions;
  toggling?: boolean;
};

/** Same row layout as My Work — used in all-items, matter page, and client popup lists. */
export function ItemCard({ as = "li", compact: _compact, variant: _variant, ...props }: Props & { as?: "li" | "div" }) {
  return <MyWorkListRow {...props} as={as} />;
}
