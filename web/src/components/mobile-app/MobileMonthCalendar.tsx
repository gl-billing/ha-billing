"use client";

import { useEffect, useRef } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  formatDisplayDate,
  formatMonthYear,
  isItemOpen,
  type CalendarCell
} from "@/lib/office-tasks/schedule";
import styles from "./mobile-month.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  year: number;
  month: number;
  today: string;
  selectedDate: string;
  grid: CalendarCell[][];
  holidayMap: Map<string, string>;
  dayLookup: (date: string) => OfficeItem[];
  onShiftMonth: (delta: number) => void;
  onGoToday: () => void;
  onOpenDay: (date: string) => void;
};

export function MobileMonthCalendar({
  year,
  month,
  today,
  selectedDate,
  grid,
  holidayMap,
  dayLookup,
  onShiftMonth,
  onGoToday,
  onOpenDay
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cells = grid.flat();

  useEffect(() => {
    const board = boardRef.current;
    const cell = board?.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`);
    if (!board || !cell) return;
    const boardRect = board.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const pad = 10;
    if (cellRect.right > boardRect.right - pad) {
      board.scrollLeft += cellRect.right - boardRect.right + pad;
    } else if (cellRect.left < boardRect.left + pad) {
      board.scrollLeft -= boardRect.left - cellRect.left + pad;
    }
  }, [selectedDate, year, month]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.navRow}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onShiftMonth(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className={styles.monthTitle}>{formatMonthYear(year, month)}</p>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onShiftMonth(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <button type="button" className={styles.todayBtn} onClick={onGoToday}>
          Today
        </button>
      </div>

      <div ref={boardRef} className={`ha-mobile-month-board ${styles.board}`}>
        <div className={`ha-mobile-month-grid ${styles.grid}`}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}
          {cells.map((cell) => {
            const dayItems = dayLookup(cell.date);
            const openCount = dayItems.reduce((n, item) => n + (isItemOpen(item) ? 1 : 0), 0);
            const isToday = cell.date === today;
            const isSelected = cell.date === selectedDate;
            const dayNum = Number(cell.date.slice(8, 10));
            const holidayName = holidayMap.get(cell.date);
            const className = [
              styles.cell,
              !cell.inMonth ? styles.cellMuted : "",
              isToday ? styles.cellToday : "",
              isSelected ? styles.cellSelected : ""
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={cell.date}
                type="button"
                data-date={cell.date}
                className={className}
                onClick={() => onOpenDay(cell.date)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${formatDisplayDate(cell.date, "short")}${
                  holidayName ? `, ${holidayName}` : ""
                }, ${dayItems.length} tasks, ${openCount} open`}
              >
                <span className={styles.dateRow}>
                  <span className={`ha-month-date ${styles.dateNum}`}>{dayNum}</span>
                  <span className={styles.dateMarks}>
                    {holidayName ? (
                      <span className={styles.holidayMark} title={holidayName} />
                    ) : null}
                    {isToday ? <span className={styles.todayMark} /> : null}
                  </span>
                </span>
                {dayItems.length > 0 ? (
                  <div className={styles.stats}>
                    <span className={`ha-month-stat ${styles.statTotal}`}>
                      {dayItems.length} task{dayItems.length === 1 ? "" : "s"}
                    </span>
                    <span className={`ha-month-stat-open ${styles.statOpen}`}>
                      {openCount} open
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
