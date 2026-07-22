"use client";

import { useMemo, useRef, useState } from "react";
import { DayDetailPanel } from "@/components/office-tasks/DayDetailPanel";
import { HintBar, ViewHero } from "@/components/office-tasks/PremiumUI";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import {
  addDays,
  formatDisplayDate,
  isItemOpen,
  officeItemKey,
  shortCalendarLabel
} from "@/lib/office-tasks/schedule";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00

type Props = {
  items: OfficeItem[];
  today: string;
  initialDate?: string;
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

function hourFromStartTime(startTime: string | null | undefined): number | null {
  if (!startTime) return null;
  const raw = String(startTime).trim();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour;
}

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

/**
 * Day schedule — hourly appointments for one calendar day (Clio-style daily view).
 */
export function DayScheduleView({
  items,
  today,
  initialDate,
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
  const [date, setDate] = useState(initialDate || today);
  const [highlightItemKey, setHighlightItemKey] = useState<string | null>(null);
  const detailAnchorRef = useRef<HTMLDivElement>(null);

  function openScheduleItem(item: OfficeItem, index = 0) {
    const key = officeItemKey(item, index);
    setHighlightItemKey(key);
    requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const dayItems = useMemo(() => {
    return items
      .filter((item) => isItemOpen(item) && item.date === date)
      .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  }, [items, date]);

  const byHour = useMemo(() => {
    const map = new Map<number, OfficeItem[]>();
    const untimed: OfficeItem[] = [];
    for (const item of dayItems) {
      const hour = hourFromStartTime(item.startTime);
      if (hour === null) {
        untimed.push(item);
        continue;
      }
      const bucket = Math.min(20, Math.max(7, hour));
      const list = map.get(bucket) || [];
      list.push(item);
      map.set(bucket, list);
    }
    return { map, untimed };
  }, [dayItems]);

  return (
    <div className="day-schedule-view">
      <ViewHero
        eyebrow="Daily schedule"
        title={formatDisplayDate(date, "long")}
        subtitle={`${dayItems.length} open item${dayItems.length === 1 ? "" : "s"} with times where set.`}
      />
      <HintBar>
        Hourly lanes for hearings and meetings. Items without a time appear under Untimed.
      </HintBar>

      <div className="day-schedule-view__toolbar no-print">
        <button type="button" className="btn-secondary text-sm" onClick={() => setDate(addDays(date, -1))}>
          ← Previous day
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setDate(today)}>
          Today
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setDate(addDays(date, 1))}>
          Next day →
        </button>
        <input
          type="date"
          className="rounded border border-line px-2 py-1 text-sm"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="day-schedule-view__grid">
        {HOURS.map((hour) => {
          const slotItems = byHour.map.get(hour) || [];
          return (
            <div key={hour} className="day-schedule-view__row">
              <div className="day-schedule-view__hour">{formatHourLabel(hour)}</div>
              <div className="day-schedule-view__slot">
                {slotItems.length === 0 ? (
                  <span className="day-schedule-view__empty">—</span>
                ) : (
                  slotItems.map((item, index) => (
                    <button
                      key={officeItemKey(item, index)}
                      type="button"
                      className="day-schedule-view__card day-schedule-view__card--action"
                      onClick={() => openScheduleItem(item, index)}
                      aria-label={`Open ${shortCalendarLabel(item)} in day detail`}
                    >
                      <p className="day-schedule-view__card-title">
                        {item.startTime ? `${item.startTime} · ` : ""}
                        {shortCalendarLabel(item)}
                      </p>
                      <p className="day-schedule-view__card-meta">
                        {item.clientCase || "No client"}
                        {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {byHour.untimed.length ? (
        <div className="day-schedule-view__untimed">
          <p className="section-label">Untimed</p>
          <ul className="day-schedule-view__untimed-list">
            {byHour.untimed.map((item, index) => (
              <li key={officeItemKey(item, index)}>
                <button
                  type="button"
                  className="day-schedule-view__card day-schedule-view__card--action"
                  onClick={() => openScheduleItem(item, index)}
                  aria-label={`Open ${shortCalendarLabel(item)} in day detail`}
                >
                  <p className="day-schedule-view__card-title">{shortCalendarLabel(item)}</p>
                  <p className="day-schedule-view__card-meta">
                    {item.clientCase || "No client"}
                    {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div ref={detailAnchorRef} className="day-schedule-view__detail-anchor" />
      <DayDetailPanel
        date={date}
        items={dayItems}
        today={today}
        highlightItemKey={highlightItemKey}
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
