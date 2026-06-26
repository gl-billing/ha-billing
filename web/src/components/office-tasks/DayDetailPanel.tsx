"use client";

import { useRef, useEffect, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { getPhilippineRegularHoliday } from "@/lib/office-tasks/philippine-holidays";
import { bucketItemsForDay, formatDisplayDate, officeItemKey } from "@/lib/office-tasks/schedule";

type Props = {
  date: string;
  items: OfficeItem[];
  today: string;
  onClear?: () => void;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
} & WorkItemFilingActionProps;

const BUCKETS = [
  { key: "overdue" as const, title: "Fix first — overdue", icon: "!", border: "border-red-400" },
  { key: "events" as const, title: "Hearings & meetings", icon: "◆", border: "border-blue-400" },
  { key: "deadlines" as const, title: "Filings & deadlines", icon: "▪", border: "border-rose-400" },
  { key: "tasks" as const, title: "Tasks", icon: "●", border: "border-green/50" },
  { key: "done" as const, title: "Completed", icon: "✓", border: "border-gray-300" }
];

export function DayDetailPanel({
  date,
  items,
  today,
  onClear,
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
  togglingKey
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const prevDateRef = useRef<string | null>(null);
  const buckets = bucketItemsForDay(items, date, today);
  const total = items.length;
  const isToday = date === today;
  const phHoliday = getPhilippineRegularHoliday(date);

  useEffect(() => {
    if (prevDateRef.current === null) {
      prevDateRef.current = date;
      return;
    }
    if (prevDateRef.current === date) return;
    prevDateRef.current = date;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [date]);

  return (
    <section ref={panelRef} className="day-detail-panel no-print">
      <div className="day-detail-panel__header flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="view-eyebrow">{isToday ? "Today" : "Selected date"}</p>
          <h3 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">{formatDisplayDate(date)}</h3>
          {phHoliday ? (
            <p className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-900">
              PH regular holiday · {phHoliday}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            {total === 0
              ? phHoliday
                ? "No office items on this holiday — choose another day above."
                : "Nothing on this date — choose another day above."
              : `${total} item${total === 1 ? "" : "s"} · grouped by priority`}
          </p>
        </div>
        {onClear && (
          <button type="button" className="btn-secondary px-4 py-1.5 text-xs" onClick={onClear}>
            Close
          </button>
        )}
      </div>

      <div className="day-detail-panel__body">
        {total === 0 ? (
          <EmptyState title="Clear day" message="No tasks, hearings, or deadlines scheduled for this date." />
        ) : (
          <div className="space-y-3">
            {BUCKETS.map(({ key, title, icon, border }) => {
              const list = buckets[key];
              if (!list.length) return null;
              if (key === "done") {
                return (
                  <DoneBucket
                    key={key}
                    title={title}
                    icon={icon}
                    border={border}
                    items={list}
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
                    togglingKey={togglingKey}
                  />
                );
              }
              return (
                <div key={key} className={`bucket-section border-l-4 ${border}`}>
                  <h4 className="bucket-section__title">
                    <span className="bucket-section__icon" aria-hidden>
                      {icon}
                    </span>
                    {title}
                    <span className="bucket-section__count">{list.length}</span>
                  </h4>
                  <ul className="bucket-section__items my-work-list my-work-panel--elegant">
                    {list.map((item, index) => {
                      const itemKey = officeItemKey(item, index);
                      return (
                        <ItemCard
                          key={itemKey}
                          item={item}
                          variant="day-detail"
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
                          toggling={togglingKey === itemKey}
                        />
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function DoneBucket({
  title,
  icon,
  border,
  items,
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
  togglingKey
}: {
  title: string;
  icon: string;
  border: string;
  items: OfficeItem[];
  onToggleDone?: Props["onToggleDone"];
  onSetStatus?: Props["onSetStatus"];
  onResetWithDate?: Props["onResetWithDate"];
  onDeleteItem?: Props["onDeleteItem"];
  onUpdateNextAction?: Props["onUpdateNextAction"];
  onSaveEdit?: Props["onSaveEdit"];
  onCourtConfirmed?: Props["onCourtConfirmed"];
  formOptions?: Props["formOptions"];
  togglingKey?: string | null;
} & WorkItemFilingActionProps) {
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <div className={`bucket-section border-l-4 ${border}`}>
      <button
        type="button"
        className="collapsible-section__toggle flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h4 className="bucket-section__title mb-0 flex-1">
          <span className="bucket-section__icon" aria-hidden>
            {icon}
          </span>
          {title}
          <span className="bucket-section__count">{count}</span>
        </h4>
        <span className="collapsible-section__action shrink-0 text-[11px]">
          {open ? "Hide" : `Show (${count})`}
        </span>
      </button>
      <ul className={`bucket-section__items my-work-list my-work-panel--elegant ${open ? "" : "my-work-list--collapsed"}`}>
        {items.map((item, index) => {
          const itemKey = officeItemKey(item, index);
          return (
            <ItemCard
              key={itemKey}
              item={item}
              variant="day-detail"
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
              toggling={togglingKey === itemKey}
            />
          );
        })}
      </ul>
    </div>
  );
}
