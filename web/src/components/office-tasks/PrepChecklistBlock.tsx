"use client";

import { useMemo } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { TaskPrepChecklist } from "@/components/office-tasks/TaskPrepChecklist";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isHearingEventCategory } from "@/lib/office-tasks/event-form-utils";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import {
  canOfferPrepChecklistCreation,
  prepChecklistTitleForItem,
  resolvePrepChecklistHost,
  resolvePrepChecklistInitTarget
} from "@/lib/office-tasks/prep-checklist-client";
import { looksLikePrepReminderTask } from "@/lib/office-tasks/prep-task-event-link";
import {
  resolvePrepWorkloadViewRole,
  shouldShowPrepChecklistForViewer,
  type PrepWorkloadViewRole
} from "@/lib/office-tasks/prep-workload-view";

type Props = {
  item: ItemSummary;
  allItems: OfficeItem[];
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
  disabled?: boolean;
  collapsedDefault?: boolean;
  creating?: boolean;
  /** body = interactive checklist; toolbar = compact add/enable actions */
  surface?: "body" | "toolbar";
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
};

function toSummary(item: OfficeItem): ItemSummary {
  return item;
}

function resolveRole(
  viewerStaffName: string | undefined,
  roster: string[],
  viewerPrepRole?: PrepWorkloadViewRole
): PrepWorkloadViewRole {
  if (viewerPrepRole) return viewerPrepRole;
  if (!viewerStaffName?.trim()) return "neutral";
  return resolvePrepWorkloadViewRole(viewerStaffName, roster);
}

export function PrepChecklistBlock({
  item,
  allItems,
  viewerStaffName,
  viewerPrepRole,
  roster = [],
  disabled,
  collapsedDefault = false,
  creating,
  surface = "body",
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist
}: Props) {
  const role = useMemo(
    () => resolveRole(viewerStaffName, roster, viewerPrepRole),
    [viewerStaffName, roster, viewerPrepRole]
  );
  const host = useMemo(() => resolvePrepChecklistHost(item as OfficeItem, allItems), [item, allItems]);
  const initTarget = useMemo(() => resolvePrepChecklistInitTarget(item as OfficeItem, allItems), [item, allItems]);
  const canCreate = useMemo(() => canOfferPrepChecklistCreation(item as OfficeItem), [item]);
  const showChecklist = shouldShowPrepChecklistForViewer(item as OfficeItem, allItems, role);
  const hearing = isHearingEventCategory(item.category);

  if (host && onTogglePrepChecklistItem && showChecklist && surface === "body") {
    return (
      <TaskPrepChecklist
        remarks={host.remarks || ""}
        title={prepChecklistTitleForItem(host)}
        disabled={disabled}
        collapsedDefault={collapsedDefault}
        onToggleItem={(itemIndex, checked) => onTogglePrepChecklistItem(toSummary(host), itemIndex, checked)}
        onMutateItem={
          onMutatePrepChecklistItem
            ? (mutation) => onMutatePrepChecklistItem(toSummary(host), mutation)
            : undefined
        }
      />
    );
  }

  if (surface !== "toolbar") {
    return null;
  }

  if (initTarget && onInitializePrepChecklist && showChecklist) {
    const legacyPrep = initTarget.source === "Task" && looksLikePrepReminderTask(initTarget);
    const label = creating
      ? "Adding…"
      : hearing
        ? "Hearing prep"
        : legacyPrep
          ? "Enable checklist"
          : "Add checklist";
    return (
      <button
        type="button"
        className="my-work-list__btn my-work-list__btn--ghost my-work-list__btn--accent"
        disabled={disabled || creating}
        onClick={() => onInitializePrepChecklist(item)}
      >
        {label}
      </button>
    );
  }

  if (canCreate && onCreatePrepChecklist && showChecklist) {
    return (
      <button
        type="button"
        className="my-work-list__btn my-work-list__btn--ghost my-work-list__btn--accent"
        disabled={disabled || creating}
        onClick={() => onCreatePrepChecklist(item)}
      >
        {creating ? "Creating…" : hearing ? "Hearing prep" : "Filing prep"}
      </button>
    );
  }

  return null;
}
