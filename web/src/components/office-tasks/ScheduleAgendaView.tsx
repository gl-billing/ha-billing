"use client";

import { useMemo, useState } from "react";
import { DayDetailPanel } from "@/components/office-tasks/DayDetailPanel";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { SameWindowLink } from "@/components/SameWindowLink";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import { tasksHref } from "@/lib/tasks-routes";
import {
  addDays,
  formatDisplayDate,
  isCancelledStatus,
  itemTone,
  officeItemKey,
  shortCalendarLabel,
  toneClass
} from "@/lib/office-tasks/schedule";

type Props = {
  items: OfficeItem[];
  today: string;
  /** How many days ahead to list (default 21). */
  horizonDays?: number;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
} & WorkItemFilingActionProps;

/**
 * Bitrix-style Schedule (agenda) — chronological list of upcoming items by date.
 */
export function ScheduleAgendaView({
  items,
  today,
  horizonDays = 21,
  formOptions,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled
}: Props) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [highlightItemKey, setHighlightItemKey] = useState<string | null>(null);
  const end = addDays(today, Math.max(1, horizonDays) - 1);

  const groups = useMemo(() => {
    const byDate = new Map<string, OfficeItem[]>();
    for (const item of items) {
      if (!item.date || item.date < today || item.date > end) continue;
      if (isCancelledStatus(item.status)) continue;
      const list = byDate.get(item.date) || [];
      list.push(item);
      byDate.set(item.date, list);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayItems]) => ({
        date,
        items: dayItems.sort((a, b) =>
          String(a.startTime || "").localeCompare(String(b.startTime || ""))
        )
      }));
  }, [items, today, end]);

  const selectedItems = useMemo(
    () => groups.find((g) => g.date === selectedDate)?.items || [],
    [groups, selectedDate]
  );

  return (
    <div className="schedule-agenda-view">
      <div className="schedule-agenda-view__head">
        <div>
          <p className="schedule-agenda-view__eyebrow">Schedule</p>
          <h3 className="schedule-agenda-view__title">Upcoming</h3>
          <p className="schedule-agenda-view__lede">
            {formatDisplayDate(today, "short")} – {formatDisplayDate(end, "short")}
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          message={`No events in the next ${horizonDays} days.`}
          action={
            <SameWindowLink href={tasksHref({ tab: "add-event" })} className="btn-primary text-sm">
              Add event
            </SameWindowLink>
          }
          compact
        />
      ) : (
        <div className="schedule-agenda-view__list">
          {groups.map((group) => (
            <section key={group.date} className="schedule-agenda-view__day">
              <button
                type="button"
                className={`schedule-agenda-view__day-head${
                  group.date === selectedDate ? " schedule-agenda-view__day-head--active" : ""
                }${group.date === today ? " schedule-agenda-view__day-head--today" : ""}`}
                onClick={() => {
                  setSelectedDate(group.date);
                  setHighlightItemKey(null);
                }}
              >
                <span className="schedule-agenda-view__day-label">
                  {formatDisplayDate(group.date, group.date === today ? "long" : "short")}
                </span>
                <span className="schedule-agenda-view__day-count">{group.items.length}</span>
              </button>
              <ul className="schedule-agenda-view__items">
                {group.items.map((item) => {
                  const key = officeItemKey(item);
                  const tone = itemTone(item, today);
                  const done = tone === "done";
                  const selected = highlightItemKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`schedule-agenda-view__item ${toneClass(tone)}${
                          done ? " schedule-agenda-view__item--done" : ""
                        }${selected ? " schedule-agenda-view__item--selected" : ""}`}
                        onClick={() => {
                          if (item.date) setSelectedDate(item.date);
                          setHighlightItemKey(key);
                        }}
                        aria-pressed={selected}
                        aria-label={`${shortCalendarLabel(item)}. Open details.`}
                      >
                        <span className="schedule-agenda-view__time">
                          {item.startTime?.trim() || "—"}
                        </span>
                        <span className="schedule-agenda-view__body">
                          <span className="schedule-agenda-view__name">{shortCalendarLabel(item)}</span>
                          <span className="schedule-agenda-view__meta">
                            {item.clientCase || "No client"}
                            {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <DayDetailPanel
        date={selectedDate}
        items={selectedItems}
        today={today}
        highlightItemKey={highlightItemKey}
        onClear={() => setHighlightItemKey(null)}
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
    </div>
  );
}
