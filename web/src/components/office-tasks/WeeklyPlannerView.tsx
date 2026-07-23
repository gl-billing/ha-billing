"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { DayDetailPanel } from "@/components/office-tasks/DayDetailPanel";
import { CollapsibleItemSection } from "@/components/office-tasks/CollapsibleItemSection";
import { HintBar, StatTile, ToneLegend, ViewHero } from "@/components/office-tasks/PremiumUI";
import { ClientCaseLink } from "@/components/office-tasks/ClientCodeBadge";
import { openPrintPreview } from "@/lib/print-preview";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import {
  getPhilippineRegularHoliday,
  shortPhilippineHolidayLabel
} from "@/lib/office-tasks/philippine-holidays";
import {
  addDays,
  formatDisplayDate,
  getMondayOfWeek,
  getWeekDates,
  getWeekPlan,
  isItemOpen,
  itemTone,
  officeItemKey,
  shortCalendarLabel,
  toneClass,
  toneDotClass
} from "@/lib/office-tasks/schedule";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  items: OfficeItem[];
  today: string;
  initialWeekStart?: string;
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

export function WeeklyPlannerView({
  items,
  today,
  initialWeekStart,
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
  const [weekStart, setWeekStart] = useState(initialWeekStart || getMondayOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const boardRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const { overdue, byDay } = useMemo(() => getWeekPlan(items, weekDates, today), [items, weekDates, today]);

  const weekEnd = weekDates[6];
  const weekLabel = `${formatDisplayDate(weekDates[0], "short")} – ${formatDisplayDate(weekEnd, "short")}`;
  const weekTotal = byDay.reduce((s, d) => s + d.length, 0);
  const busiestIdx = byDay.findIndex((d) => d.length === Math.max(...byDay.map((x) => x.length), 0));
  const selectedItems = useMemo(() => {
    const idx = weekDates.indexOf(selectedDate);
    return idx >= 0 ? byDay[idx] : [];
  }, [weekDates, selectedDate, byDay]);

  function shiftWeek(delta: number) {
    setWeekStart(addDays(weekStart, delta * 7));
  }

  useEffect(() => {
    for (const container of [boardRef.current, stripRef.current]) {
      const target = container?.querySelector<HTMLElement>(`[data-week-date="${selectedDate}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [selectedDate, weekStart]);

  return (
    <div id="print-weekly" className="print-root">
      <FirmPrintLetterhead onlyPrint documentType="Weekly planner" documentTitle={weekLabel} />
      <ViewHero
        eyebrow="Weekly planner"
        title={weekLabel}
        subtitle="Scan the week at a glance, then select a day for hearings, filings, and tasks in full detail."
        action={
          <button type="button" className="btn-primary w-full shrink-0 px-4 py-2 text-xs sm:w-auto sm:max-w-[150px]" onClick={() => openPrintPreview({ title: `HA Office Weekly Plan ${weekLabel}`, sourceId: "print-weekly" })}>
            Print
          </button>
        }
      />

      <div className="no-print mb-3 flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => shiftWeek(-1)}>
          ← Prev
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            setWeekStart(getMondayOfWeek(today));
            setSelectedDate(today);
          }}
        >
          This week
        </button>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => shiftWeek(1)}>
          Next →
        </button>
      </div>

      <div className="no-print mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Overdue" value={overdue.length} variant={overdue.length > 0 ? "red" : "muted"} />
        <StatTile label="This week" value={weekTotal} variant="blue" />
        <StatTile label="Busiest" value={Math.max(...byDay.map((d) => d.length), 0)} variant="gold" sub={DAY_SHORT[busiestIdx] || "—"} />
        <StatTile label="Selected day" value={selectedItems.length} variant="green" />
      </div>

      <HintBar className="md:hidden">Select a day below — full details appear underneath. Swipe sideways for Sat–Sun.</HintBar>
      <HintBar className="hidden md:block">Mon–Fri shown first — scroll sideways for Sat–Sun, then select a day for full details below.</HintBar>
      <ToneLegend className="mb-3" />

      <div ref={boardRef} className="no-print weekly-board scroll-panel-hint">
        <div className="weekly-board__grid">
          {weekDates.map((date, i) => {
            const dayItems = byDay[i];
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const openCount = dayItems.filter((it) => isItemOpen(it)).length;
            const tones = [...new Set(dayItems.map((it) => itemTone(it, today)))].slice(0, 4);
            const holidayName = getPhilippineRegularHoliday(date);

            return (
              <div
                key={date}
                data-week-date={date}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedDate(date);
                  }
                }}
                aria-pressed={isSelected}
                className={`weekly-day-column flex min-w-0 cursor-pointer flex-col border p-2.5 text-left transition-colors duration-150 ${
                  isSelected ? "weekly-day-column--selected border-ink bg-white" : "border-line bg-white/80 hover:border-ink/40 hover:bg-white"
                } ${isToday && !isSelected ? "border-ink/50" : ""} ${
                  holidayName ? "weekly-day-column--ph-holiday" : ""
                }`}
              >
                <div className="weekly-day-column__head border-b border-line/70 pb-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{DAY_SHORT[i]}</p>
                  <p className="font-display text-2xl font-semibold leading-none text-ink">{date.slice(8, 10)}</p>
                  {holidayName ? (
                    <p className="calendar-day-ph-label mt-1 !mb-0 text-left" title={holidayName}>
                      {shortPhilippineHolidayLabel(holidayName, 18)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[10px] font-semibold text-muted">
                      {formatDisplayDate(date, "short").replace(/,?\s*\d{4}$/, "")}
                    </p>
                  )}
                  {isToday && (
                    <span className="mt-1.5 inline-block border border-ink bg-ink px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider text-white">
                      Today
                    </span>
                  )}
                </div>
                <div className="mt-2 flex-1">
                  {dayItems.length === 0 ? (
                    <p className="py-6 text-center text-[10px] font-semibold italic text-muted">—</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dayItems.slice(0, 4).map((item, index) => (
                        <div
                          key={officeItemKey(item, index)}
                          className={`weekly-day-mini-card rounded-lg border px-1.5 py-1 text-[9px] leading-tight shadow-sm ${toneClass(itemTone(item, today))}`}
                        >
                          <p className="font-extrabold uppercase tracking-wide opacity-80">{shortCalendarLabel(item)}</p>
                          <ClientCaseLink
                            clientCase={item.clientCase}
                            className="weekly-mini-case-link font-semibold"
                          />
                          <p className="weekly-day-mini-card__assignee opacity-80">{item.assignedTo || "Unassigned"}</p>
                        </div>
                      ))}
                      {dayItems.length > 4 && (
                        <p className="text-center text-[9px] font-bold text-gold">+{dayItems.length - 4}</p>
                      )}
                    </div>
                  )}
                </div>
                {tones.length > 0 && (
                  <div className="mt-2 flex justify-center gap-0.5">
                    {tones.map((t) => (
                      <span key={t} className={toneDotClass(t)} />
                    ))}
                  </div>
                )}
                {dayItems.length > 0 && (
                  <div className="mt-2 space-y-0.5 text-left">
                    <p className="calendar-day-stat calendar-day-stat--tasks">{dayItems.length} tasks</p>
                    {openCount > 0 ? (
                      <p className="calendar-day-stat calendar-day-stat--open">{openCount} open</p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div ref={stripRef} className="weekly-day-strip scroll-panel-hint no-print mt-4">
        <div className="weekly-day-strip__grid">
          {weekDates.map((date, i) => {
            const dayItems = byDay[i];
            const openCount = dayItems.filter((it) => isItemOpen(it)).length;
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const holidayName = getPhilippineRegularHoliday(date);

            return (
              <button
                key={`strip-${date}`}
                type="button"
                data-week-date={date}
                onClick={() => setSelectedDate(date)}
                aria-pressed={isSelected}
                aria-label={`${DAY_NAMES[i]}, ${dayItems.length} tasks, ${openCount} open`}
                className={`weekly-strip-day ${isSelected ? "weekly-strip-day--selected" : ""} ${
                  isToday ? "weekly-strip-day--today" : ""
                } ${holidayName ? "weekly-strip-day--ph-holiday" : ""}`}
              >
                <div className="weekly-strip-day__head">
                  <span className="weekly-strip-day__dow">{DAY_SHORT[i]}</span>
                  <span className="weekly-strip-day__num">{date.slice(8, 10)}</span>
                </div>
                {holidayName ? (
                  <p className="weekly-strip-day__holiday" title={holidayName}>
                    {shortPhilippineHolidayLabel(holidayName, 16)}
                  </p>
                ) : null}
                {dayItems.length > 0 ? (
                  <div className="weekly-strip-day__stats">
                    <p className="weekly-strip-day__stat weekly-strip-day__stat--tasks">
                      {dayItems.length} tasks
                    </p>
                    {openCount > 0 ? (
                      <p className="weekly-strip-day__stat weekly-strip-day__stat--open">{openCount} open</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="weekly-strip-day__empty">—</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {overdue.length > 0 && (
        <CollapsibleItemSection
          title="Fix first — overdue"
          items={overdue}
          showLabel="Show overdue"
          hideLabel="Hide overdue"
          collapsedByDefault
          className="item-list-section--overdue border-l-4 border-red-400 no-print"
          onToggleDone={onToggleDone}
          onSetStatus={onSetStatus}
          onResetWithDate={onResetWithDate}
          onDeleteItem={onDeleteItem}
          onUpdateNextAction={onUpdateNextAction}
          onSaveEdit={onSaveEdit}
          onCourtConfirmed={onCourtConfirmed}
          formOptions={formOptions}
          togglingKey={togglingKey}
        />
      )}

      <DayDetailPanel
        date={selectedDate}
        items={selectedItems}
        today={today}
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

      <div className="print-only-week-list mt-4 hidden space-y-6 print:block">
        {weekDates.map((date, i) => (
          <section key={date}>
            <h3 className="font-bold">
              {DAY_NAMES[i]} — {formatDisplayDate(date)}
            </h3>
            {byDay[i].map((item, index) => (
              <p key={officeItemKey(item, index)} className="text-sm">
                {item.clientCase}: {item.details}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
