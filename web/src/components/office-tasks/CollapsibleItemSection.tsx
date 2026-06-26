"use client";

import { useEffect, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import { officeItemKey } from "@/lib/office-tasks/schedule";

type Props = {
  title: string;
  items: OfficeItem[];
  showLabel?: string;
  hideLabel?: string;
  collapsedByDefault?: boolean;
  className?: string;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  /** Increment to auto-expand when jumping from stat tiles. */
  openWhen?: number;
} & WorkItemFilingActionProps;

export function CollapsibleItemSection({
  title,
  items,
  showLabel = "Show completed",
  hideLabel = "Hide completed",
  collapsedByDefault = true,
  className = "",
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  formOptions,
  togglingKey,
  openWhen = 0
}: Props) {
  const [open, setOpen] = useState(!collapsedByDefault);

  useEffect(() => {
    if (openWhen > 0) setOpen(true);
  }, [openWhen]);

  if (!items.length) return null;

  const count = items.length;
  const toggleText = open ? hideLabel : `${showLabel} (${count})`;

  return (
    <section className={`item-list-section item-list-section--collapsible mb-3 print-section ${className}`.trim()}>
      <div className="collapsible-section__head">
        <button
          type="button"
          className="collapsible-section__toggle no-print flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="section-label mb-0">{title}</span>
          <span className="collapsible-section__action shrink-0">{toggleText}</span>
        </button>

        <p className="collapsible-section__summary text-xs text-muted no-print">
          {open ? `${count} item${count === 1 ? "" : "s"}` : `${count} hidden — tap to expand`}
        </p>
      </div>

      <ul className={`item-list-section__items collapsible-section__body my-work-list my-work-panel--elegant ${open ? "" : "my-work-list--collapsed"}`}>
        {items.map((item, index) => {
          const key = officeItemKey(item, index);
          return (
            <ItemCard
              key={key}
              item={item}
              onToggleDone={onToggleDone}
              onSetStatus={onSetStatus}
              onResetWithDate={onResetWithDate}
              onDeleteItem={onDeleteItem}
              onUpdateNextAction={onUpdateNextAction}
              onSaveEdit={onSaveEdit}
              onCourtConfirmed={onCourtConfirmed}
              onMarkSubmitted={onMarkSubmitted}
              onConfirmParentFiled={onConfirmParentFiled}
              formOptions={formOptions}
              toggling={togglingKey === key}
            />
          );
        })}
      </ul>
    </section>
  );
}
