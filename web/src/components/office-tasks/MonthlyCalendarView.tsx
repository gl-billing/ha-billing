"use client";

import { useMemo, useState } from "react";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { ClientBirthdayCake } from "@/components/ClientBirthdayCake";
import { useTodayBirthdays } from "@/components/TodayBirthdaysProvider";
import { DayDetailPanel } from "@/components/office-tasks/DayDetailPanel";
import { clientCodeFromCase, parseClientCaseDisplay } from "@/lib/office-tasks/client-matter";
import { HintBar, StatTile, ToneLegend, ViewHero } from "@/components/office-tasks/PremiumUI";
import { openPrintPreview } from "@/lib/print-preview";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  getPhilippineRegularHolidayMap,
  shortPhilippineHolidayLabel
} from "@/lib/office-tasks/philippine-holidays";
import {
  buildMonthGrid,
  formatDisplayDate,
  formatMonthYear,
  getItemsForMonth,
  getMonthStats,
  groupItemsByDate,
  isItemOpen,
  itemTone,
  officeItemKey,
  shortCalendarLabel,
  toneDotClass,
  truncate
} from "@/lib/office-tasks/schedule";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  items: OfficeItem[];
  today: string;
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

export function MonthlyCalendarView({
  items,
  today,
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
  const { todayCodes } = useTodayBirthdays();
  const initial = parseYmdParts(today);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const byDate = useMemo(() => groupItemsByDate(items), [items]);
  const holidayMap = useMemo(() => getPhilippineRegularHolidayMap(year), [year]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const stats = useMemo(() => getMonthStats(items, year, month, today), [items, year, month, today]);
  const monthAgenda = useMemo(() => getItemsForMonth(items, year, month), [items, year, month]);
  const selectedItems = byDate[selectedDate] || [];

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToday() {
    const t = parseYmdParts(today);
    setYear(t.year);
    setMonth(t.month);
    setSelectedDate(today);
  }

  const nav = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => shiftMonth(-1)} aria-label="Previous month">
        ←
      </button>
      <span className="min-w-0 flex-1 text-center font-display text-base font-semibold text-ink sm:min-w-[9rem] sm:text-lg">{formatMonthYear(year, month)}</span>
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => shiftMonth(1)} aria-label="Next month">
        →
      </button>
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={goToday}>
        Today
      </button>
    </div>
  );

  return (
    <div id="print-monthly" className="print-root">
      <FirmPrintLetterhead
        onlyPrint
        documentType="Office calendar"
        documentTitle={formatMonthYear(year, month)}
      />
      <ViewHero
        eyebrow="Office calendar"
        title={formatMonthYear(year, month)}
        subtitle="Select any date to review hearings, filings, and tasks in full detail below."
        action={
          <button
            type="button"
            className="btn-primary w-full shrink-0 px-4 py-2 text-xs sm:w-auto sm:max-w-[150px]"
            onClick={() => openPrintPreview({ title: `HA Office Calendar ${formatMonthYear(year, month)}`, sourceId: "print-monthly" })}
          >
            Print
          </button>
        }
      />

      <div className="no-print mb-3 flex justify-center">{nav}</div>

      <HintBar>Select a date — details appear below. Scroll sideways for Sat–Sun.</HintBar>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="All" value={stats.total} variant="gold" />
        <StatTile label="Events" value={stats.events} variant="blue" />
        <StatTile label="Filings" value={stats.deadlines} variant="rose" />
        <StatTile label="Tasks" value={stats.tasks} variant="green" />
        <StatTile label="Late" value={stats.overdue} variant={stats.overdue > 0 ? "red" : "muted"} />
        <StatTile label="Done" value={stats.done} variant="muted" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ToneLegend className="mb-0" showLabel />
        <p className="tone-legend calendar-ph-holiday-legend mb-0 justify-center sm:justify-end">
          <span className="tone-legend__item">
            <span className="tone-dot tone-dot--ph-holiday" aria-hidden />
            PH regular holiday
          </span>
        </p>
      </div>

      <div className="calendar-shell scroll-panel-hint">
        <div className="calendar-shell__weekday-row">
          {WEEKDAYS.map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} className="calendar-shell__week-row">
            {week.map((cell) => {
              const dayItems = byDate[cell.date] || [];
              const openCount = dayItems.filter((i) => isItemOpen(i)).length;
              const isToday = cell.date === today;
              const isSelected = cell.date === selectedDate;
              const dayNum = Number(cell.date.slice(8, 10));
              const tones = [...new Set(dayItems.map((i) => itemTone(i)))].slice(0, 5);
              const holidayName = holidayMap.get(cell.date);

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDisplayDate(cell.date, "short")}${
                    holidayName ? `, ${holidayName}` : ""
                  }, ${dayItems.length} items`}
                  className={`calendar-day-cell ${!cell.inMonth ? "calendar-day-cell--muted" : "bg-white"} ${
                    holidayName ? "calendar-day-cell--ph-holiday" : ""
                  } ${isToday ? "calendar-day-cell--today" : ""} ${
                    isSelected ? "calendar-day-cell--selected" : ""
                  }`}
                >
                  <div className="calendar-day-head">
                    <span className="calendar-day-num">{dayNum}</span>
                  </div>
                  <div className="calendar-day-body">
                    {holidayName ? (
                      <p className="calendar-day-ph-label" title={holidayName}>
                        {shortPhilippineHolidayLabel(holidayName)}
                      </p>
                    ) : null}
                    {dayItems.length > 0 && (
                      <div className="calendar-day-stats">
                        <p className="calendar-day-stat calendar-day-stat--tasks">
                          {dayItems.length} tasks
                        </p>
                        {openCount > 0 ? (
                          <p className="calendar-day-stat calendar-day-stat--open">{openCount} open</p>
                        ) : null}
                      </div>
                    )}
                    {tones.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-0.5">
                        {tones.map((t) => (
                          <span key={t} className={toneDotClass(t)} />
                        ))}
                      </div>
                    )}
                    <div className="mt-1 hidden space-y-0.5 sm:block">
                      {dayItems.slice(0, 2).map((item, index) => {
                        const itemCode = clientCodeFromCase(item.clientCase || "");
                        const showCake = Boolean(itemCode && todayCodes.has(itemCode));
                        const display = parseClientCaseDisplay(item.clientCase || item.details);
                        return (
                          <p
                            key={officeItemKey(item, index)}
                            className="calendar-day-item"
                          >
                            <span className="text-muted">{shortCalendarLabel(item)}:</span>{" "}
                            <span className="client-name-case-label client-name-case-label--compact">
                              <span className="client-name-case-label__name-group">
                                <span className="client-case-link__name">{display.title}</span>
                                {showCake ? <ClientBirthdayCake className="client-birthday-cake--compact" /> : null}
                              </span>
                              {display.subtitle ? (
                                <>
                                  <span className="client-name-case-label__sep"> — </span>
                                  <span className="client-name-case-label__case">{display.subtitle}</span>
                                </>
                              ) : null}
                            </span>
                          </p>
                        );
                      })}
                      {dayItems.length > 2 && (
                        <p className="text-[8px] font-bold text-gold">+{dayItems.length - 2} more</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

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

      <section className="card mt-4 print-agenda hidden print:block">
        <h3 className="section-label">Monthly agenda</h3>
        <div className="space-y-3">
          {monthAgenda.map((item, index) => (
            <div key={officeItemKey(item, index)} className="border-b border-line pb-2">
              <p className="text-xs font-bold">{item.date}</p>
              <p className="font-bold">{item.clientCase}</p>
              <p className="text-sm">{item.details}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function parseYmdParts(ymd: string): { year: number; month: number } {
  const [y, m] = ymd.split("-").map(Number);
  return { year: y, month: m - 1 };
}
