"use client";

import { useEffect, useState, forwardRef } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { parseClientCaseDisplay } from "@/lib/office-tasks/client-matter";
import {
  formatDisplayDate,
  isCancelledStatus,
  myWorkItemKindLabel,
  officeItemKey,
  type DayItemBuckets
} from "@/lib/office-tasks/schedule";
import { normalizeOfficeStatus } from "@/lib/office-tasks/date-only";
import styles from "./mobile-day-detail.module.css";

const SECTIONS: Array<{
  key: keyof DayItemBuckets;
  label: string;
  tone: "overdue" | "default" | "done";
}> = [
  { key: "overdue", label: "Due first", tone: "overdue" },
  { key: "events", label: "Appearances & Appointments", tone: "default" },
  { key: "deadlines", label: "Deadlines & Filings", tone: "default" },
  { key: "tasks", label: "Tasks", tone: "default" },
  { key: "done", label: "Completed", tone: "done" }
];

type Props = {
  date: string;
  today: string;
  buckets: DayItemBuckets;
  total: number;
  holidayName?: string | null;
  selectedKey?: string | null;
  onSelectItem: (item: OfficeItem) => void;
  onViewDaily?: (date: string) => void;
};

export const MobileDayDetailPanel = forwardRef<HTMLElement, Props>(function MobileDayDetailPanel(
  {
    date,
    today,
    buckets,
    total,
    holidayName,
    selectedKey,
    onSelectItem,
    onViewDaily
  },
  ref
) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });

  useEffect(() => {
    setCollapsed({ done: true });
  }, [date]);

  const isToday = date === today;
  const summary =
    total === 0
      ? holidayName
        ? "No office items on this holiday."
        : "Nothing scheduled on this date."
      : `${total} scheduled item${total === 1 ? "" : "s"}`;

  return (
    <section ref={ref} className={`ha-mobile-day-detail ${styles.root}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{isToday ? "Today" : "Selected date"}</p>
        <h2 className={styles.title}>{formatDisplayDate(date)}</h2>
        {holidayName ? <p className={styles.holiday}>{holidayName}</p> : null}
        <p className={styles.summary}>{summary}</p>
        {onViewDaily ? (
          <button
            type="button"
            className={`btn-secondary ${styles.dailyBtn}`}
            onClick={() => onViewDaily(date)}
          >
            View Daily Schedule
          </button>
        ) : null}
      </header>

      {total === 0 ? (
        <p className={styles.empty}>
          {holidayName
            ? "This holiday has no hearings, filings, or tasks. Choose another date above."
            : "No appearances or deadlines on this date. Choose another day, or add an event from Daily."}
        </p>
      ) : (
        <div className={styles.sections}>
          {SECTIONS.map((section) => {
            const items = buckets[section.key];
            if (!items.length) return null;
            const open = !collapsed[section.key];
            return (
              <section key={section.key} className={styles.section}>
                <button
                  type="button"
                  className={styles.head}
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [section.key]: !current[section.key]
                    }))
                  }
                >
                  <h3 className={styles.headTitle}>{section.label}</h3>
                  <span className={styles.count}>{items.length}</span>
                  <span
                    className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ""}`}
                    aria-hidden
                  >
                    ›
                  </span>
                </button>
                {open ? (
                  <div className={styles.list}>
                    {items.map((item, index) => (
                      <ItemCard
                        key={officeItemKey(item, index)}
                        item={item}
                        selectedDate={date}
                        tone={section.tone}
                        selected={officeItemKey(item) === selectedKey}
                        onSelect={() => onSelectItem(item)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
});

MobileDayDetailPanel.displayName = "MobileDayDetailPanel";

function itemDispositionLabel(item: Pick<OfficeItem, "status" | "done">): string | null {
  if (isCancelledStatus(item.status)) return "Cancelled";
  const status = normalizeOfficeStatus(item.status);
  if (status === "Submitted") return "Submitted";
  if (item.done || status === "Done" || status === "Completed") return "Completed";
  return null;
}

function ItemCard({
  item,
  selectedDate,
  tone,
  selected,
  onSelect
}: {
  item: OfficeItem;
  selectedDate: string;
  tone: "overdue" | "default" | "done";
  selected: boolean;
  onSelect: () => void;
}) {
  const display = parseClientCaseDisplay(item.clientCase || "");
  const kind = myWorkItemKindLabel(item);
  const detail = item.details?.trim();
  const description = !detail || detail === "—" ? "" : detail;
  const when = formatItemWhen(item, selectedDate);
  const assignee = item.assignedTo?.trim();
  const status = itemDispositionLabel(item) || item.status?.trim() || "";
  const clientTitle = display.title?.trim() || "Untitled";
  const workTitle = description || clientTitle;
  const showClientUnderWork = Boolean(description && clientTitle);
  const who = [showClientUnderWork ? clientTitle : null, display.subtitle || null]
    .filter(Boolean)
    .join(" · ");
  const meta = [when, assignee].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      className={`${styles.card}${selected ? ` ${styles.cardSelected}` : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Open details for ${workTitle}`}
    >
      <div className={styles.body}>
        <div className={styles.cardTop}>
          <span className={styles.kind} title={kind}>
            {kind}
          </span>
          {status ? (
            <span
              className={`${styles.status}${
                tone === "overdue" ? ` ${styles.statusOverdue}` : ""
              }${tone === "done" ? ` ${styles.statusDone}` : ""}`}
            >
              {status}
            </span>
          ) : null}
        </div>
        <span className={styles.client}>{workTitle}</span>
        {who ? <span className={styles.matter}>{who}</span> : null}
        {meta ? <span className={styles.metaLine}>{meta}</span> : null}
      </div>
      <span className={styles.cardChevron} aria-hidden>
        ›
      </span>
    </button>
  );
}

function formatItemWhen(item: OfficeItem, selectedDate: string): string {
  const itemDate = String(item.date || "").trim();
  const time = String(item.startTime || "").trim();
  if (itemDate === selectedDate) return time;
  const date = formatNaturalDate(itemDate);
  return [date, time].filter(Boolean).join(" · ");
}

function formatNaturalDate(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return formatDisplayDate(trimmed, "short");
  return trimmed;
}
