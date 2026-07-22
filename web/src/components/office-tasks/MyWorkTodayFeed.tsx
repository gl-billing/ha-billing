"use client";

import { useEffect, useMemo, useState } from "react";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { MyWorkChecklistRow } from "@/components/office-tasks/MyWorkChecklistRow";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";

type TodayLists = {
  overdue: OfficeItem[];
  eventsToday: OfficeItem[];
  deadlinesToday: OfficeItem[];
  tasksDueToday: OfficeItem[];
  dueThisWeek: OfficeItem[];
  doneToday: OfficeItem[];
};

type RowProps = {
  allItems?: OfficeItem[];
  onToggleDone: (item: ItemSummary, done: boolean) => void;
  onSetStatus: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onItemStatus?: (message: string, isError?: boolean) => void;
  formOptions?: EntryFormOptions;
  togglingKey: string | null;
  isAdmin?: boolean;
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
} & WorkItemFilingActionProps;

type Props = RowProps & {
  lists: TodayLists;
  doneOpenPulse?: number;
};

function priorityRank(priority: string): number {
  const order = ["Urgent", "High", "Medium", "Low"];
  const i = order.indexOf(priority.trim());
  return i === -1 ? 99 : i;
}

function sortWorkItems(a: OfficeItem, b: OfficeItem): number {
  return (
    (a.date || "").localeCompare(b.date || "") ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.clientCase.localeCompare(b.clientCase)
  );
}

function mergeDueNow(lists: TodayLists): OfficeItem[] {
  return [...lists.eventsToday, ...lists.deadlinesToday, ...lists.tasksDueToday].sort(sortWorkItems);
}

type ChecklistGroupProps = RowProps & {
  id: string;
  tone: "overdue" | "due" | "week" | "done";
  label: string;
  hint: string;
  count: number;
  items: OfficeItem[];
  showOverdueSince?: boolean;
};

function ChecklistGroup({
  id,
  tone,
  label,
  hint,
  count,
  items,
  showOverdueSince = false,
  togglingKey,
  ...rowProps
}: ChecklistGroupProps) {
  return (
    <section
      id={id}
      className={`my-work-feed__group my-work-feed__group--${tone} today-jump-target scroll-mt-4`}
    >
      <div className="my-work-feed__group-head">
        <span className={`my-work-feed__tone my-work-feed__tone--${tone === "week" ? "due" : tone}`} aria-hidden />
        <div className="my-work-feed__group-copy">
          <h3 className="my-work-feed__group-title">{label}</h3>
          <p className="my-work-feed__group-hint">{hint}</p>
        </div>
        <span className="my-work-feed__count">{count}</span>
      </div>
      <ul className="my-work-checklist">
        {items.map((item, index) => {
          const key = officeItemKey(item, index);
          return (
            <MyWorkChecklistRow
              key={key}
              item={item}
              toggling={togglingKey === key}
              showOverdueSince={showOverdueSince}
              prepChecklistCreating={rowProps.prepChecklistCreatingKey === key}
              {...rowProps}
            />
          );
        })}
      </ul>
    </section>
  );
}

export function MyWorkTodayFeed({
  lists,
  doneOpenPulse = 0,
  ...rowProps
}: Props) {
  const dueNow = useMemo(() => mergeDueNow(lists), [lists]);
  const [doneOpen, setDoneOpen] = useState(false);
  const [mobilePriorityFeed, setMobilePriorityFeed] = useState(false);

  useEffect(() => {
    if (doneOpenPulse > 0) setDoneOpen(true);
  }, [doneOpenPulse]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => setMobilePriorityFeed(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const hasOpen =
    lists.overdue.length > 0 || dueNow.length > 0 || lists.dueThisWeek.length > 0;

  const splitDueGroups =
    mobilePriorityFeed &&
    (lists.eventsToday.length > 0 || lists.deadlinesToday.length > 0 || lists.tasksDueToday.length > 0);

  return (
    <div className="my-work-feed__body my-work-feed__body--checklist">
      {!hasOpen && lists.doneToday.length === 0 ? (
        <p className="my-work-checklist__empty">No open assignments for this view.</p>
      ) : null}

      {lists.overdue.length > 0 ? (
        <ChecklistGroup
          id="today-overdue"
          tone="overdue"
          label="Overdue"
          hint="Past due — complete or reschedule promptly"
          count={lists.overdue.length}
          items={lists.overdue}
          showOverdueSince
          {...rowProps}
        />
      ) : null}

      {splitDueGroups ? (
        <>
          {lists.eventsToday.length > 0 ? (
            <ChecklistGroup
              id="today-hearings"
              tone="due"
              label="Hearings today"
              hint="Court appearances and scheduled hearings"
              count={lists.eventsToday.length}
              items={lists.eventsToday}
              {...rowProps}
            />
          ) : null}
          {lists.deadlinesToday.length > 0 ? (
            <ChecklistGroup
              id="today-filings"
              tone="due"
              label="Filings & deadlines"
              hint="Submissions and filing deadlines due today"
              count={lists.deadlinesToday.length}
              items={lists.deadlinesToday}
              {...rowProps}
            />
          ) : null}
          {lists.tasksDueToday.length > 0 ? (
            <ChecklistGroup
              id="today-tasks"
              tone="due"
              label="Tasks due today"
              hint="Drafting, follow-ups, and prep work"
              count={lists.tasksDueToday.length}
              items={lists.tasksDueToday}
              {...rowProps}
            />
          ) : null}
        </>
      ) : dueNow.length > 0 ? (
        <ChecklistGroup
          id="today-due"
          tone="due"
          label="Due now"
          hint="Hearings, deadlines, and tasks due today"
          count={dueNow.length}
          items={dueNow}
          {...rowProps}
        />
      ) : null}

      {lists.dueThisWeek.length > 0 ? (
        <ChecklistGroup
          id="today-week"
          tone="week"
          label="Due this week"
          hint="Scheduled through end of week"
          count={lists.dueThisWeek.length}
          items={lists.dueThisWeek}
          {...rowProps}
        />
      ) : null}

      <section id="today-done" className="my-work-feed__group my-work-feed__group--done today-jump-target scroll-mt-4">
        <div
          className={`my-work-feed__group-head ${lists.doneToday.length > 0 ? "my-work-feed__group-head--collapsible" : ""}`.trim()}
          role={lists.doneToday.length > 0 ? "button" : undefined}
          tabIndex={lists.doneToday.length > 0 ? 0 : undefined}
          aria-expanded={lists.doneToday.length > 0 ? doneOpen : undefined}
          onClick={lists.doneToday.length > 0 ? () => setDoneOpen((open) => !open) : undefined}
          onKeyDown={
            lists.doneToday.length > 0
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDoneOpen((open) => !open);
                  }
                }
              : undefined
          }
        >
          <span className="my-work-feed__tone my-work-feed__tone--done" aria-hidden />
          <div className="my-work-feed__group-copy">
            <h3 className="my-work-feed__group-title">Completed</h3>
            <p className="my-work-feed__group-hint">
              {lists.doneToday.length === 0
                ? "Nothing completed yet today"
                : doneOpen
                  ? `${lists.doneToday.length} completed`
                  : `${lists.doneToday.length} completed — expand to review`}
            </p>
          </div>
          <span className="my-work-feed__count">{lists.doneToday.length}</span>
          {lists.doneToday.length > 0 ? (
            <span className="my-work-feed__toggle no-print">{doneOpen ? "Hide" : "Show"}</span>
          ) : null}
        </div>
        {lists.doneToday.length > 0 ? (
          <ul className={`my-work-checklist ${doneOpen ? "" : "my-work-checklist--collapsed"}`.trim()}>
            {lists.doneToday.map((item, index) => {
              const key = officeItemKey(item, index);
              return (
                <MyWorkChecklistRow
                  key={key}
                  item={item}
                  toggling={rowProps.togglingKey === key}
                  prepChecklistCreating={rowProps.prepChecklistCreatingKey === key}
                  {...rowProps}
                />
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
