"use client";

import { useEffect, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import { officeItemKey } from "@/lib/office-tasks/schedule";

type Props = {
  items: OfficeItem[];
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  /** Increment to auto-expand when jumping from stat tiles. */
  openWhen?: number;
  className?: string;
};

export function FollowUpRemindersPanel({
  items,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onUpdateNextAction,
  onSaveEdit,
  onCourtConfirmed,
  formOptions,
  togglingKey,
  openWhen = 0,
  className = ""
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openWhen > 0) setOpen(true);
  }, [openWhen]);

  if (!items.length) return null;

  const count = items.length;
  const listId = "follow-up-task-list";

  return (
    <section
      className={`follow-up-panel follow-up-panel--premium card-elevated print-section ${open ? "follow-up-panel--open" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="follow-up-panel__trigger no-print"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
      >
        <div className="follow-up-panel__trigger-main">
          <span className="follow-up-panel__badge">Reminder</span>
          <h2 className="follow-up-panel__title">Don&apos;t forget to follow up</h2>
          <p className="follow-up-panel__desc">
            {count} task{count === 1 ? " is" : "s are"} waiting or started.
          </p>
        </div>
        <div className="follow-up-panel__trigger-action" aria-hidden>
          <span className="follow-up-panel__count">{count}</span>
          <span className="follow-up-panel__action-label">{open ? "Hide list" : "View tasks"}</span>
          <span className={`follow-up-panel__chevron ${open ? "follow-up-panel__chevron--open" : ""}`}>▼</span>
        </div>
      </button>

      <ul
        id={listId}
        className={`follow-up-panel__items my-work-list my-work-panel--elegant ${open ? "" : "my-work-list--collapsed"}`}
      >
        {items.map((item, index) => {
          const key = officeItemKey(item, index);
          return (
            <ItemCard
              key={key}
              item={item}
              onToggleDone={onToggleDone}
              onSetStatus={onSetStatus}
              onResetWithDate={onResetWithDate}
              onUpdateNextAction={onUpdateNextAction}
              onSaveEdit={onSaveEdit}
              onCourtConfirmed={onCourtConfirmed}
              formOptions={formOptions}
              toggling={togglingKey === key}
            />
          );
        })}
      </ul>
    </section>
  );
}
