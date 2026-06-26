"use client";

import { useEffect, useMemo, useState } from "react";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { MyWorkListRow } from "@/components/office-tasks/MyWorkListRow";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";

type TodayLists = {
  overdue: OfficeItem[];
  waitingAndStarted: OfficeItem[];
  eventsToday: OfficeItem[];
  deadlinesToday: OfficeItem[];
  tasksDueToday: OfficeItem[];
  doneToday: OfficeItem[];
};

type Props = {
  lists: TodayLists;
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
  doneOpenPulse?: number;
  waitingOpenPulse?: number;
  viewerStaffName?: string;
  viewerPrepRole?: import("@/lib/office-tasks/prep-workload-view").PrepWorkloadViewRole;
  roster?: string[];
} & WorkItemFilingActionProps;

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

function mergeDueToday(lists: TodayLists): OfficeItem[] {
  return [...lists.eventsToday, ...lists.deadlinesToday, ...lists.tasksDueToday].sort(sortWorkItems);
}

export function MyWorkTodayFeed({
  lists,
  allItems = [],
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey = null,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onScheduleEmailSent,
  onItemStatus,
  formOptions,
  togglingKey,
  doneOpenPulse = 0,
  waitingOpenPulse = 0,
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: Props) {
  const dueToday = useMemo(() => mergeDueToday(lists), [lists]);
  const [doneOpen, setDoneOpen] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);

  useEffect(() => {
    if (doneOpenPulse > 0) setDoneOpen(true);
  }, [doneOpenPulse]);

  useEffect(() => {
    if (waitingOpenPulse > 0) setWaitingOpen(true);
  }, [waitingOpenPulse]);

  const cardProps = {
    allItems,
    onToggleDone,
    onSetStatus,
    onResetWithDate,
    onDeleteItem,
    onUpdateNextAction,
    onTogglePrepChecklistItem,
    onMutatePrepChecklistItem,
    onCreatePrepChecklist,
    onInitializePrepChecklist,
    prepChecklistCreatingKey,
    onSaveEdit,
    onCourtConfirmed,
    onMarkSubmitted,
    onConfirmParentFiled,
    onScheduleEmailSent,
    onItemStatus,
    formOptions,
    togglingKey,
    viewerStaffName,
    viewerPrepRole,
    roster
  };

  return (
    <div className="my-work-feed__body">
      {lists.overdue.length > 0 ? (
        <FeedGroup
          id="today-overdue"
          tone="overdue"
          label="Due first"
          hint="Past due — handle these before anything else"
          count={lists.overdue.length}
          items={lists.overdue}
          {...cardProps}
        />
      ) : null}

      {dueToday.length > 0 ? (
        <FeedGroup
          id="today-due"
          tone="due"
          label="Due today"
          hint="Hearings, events, filings, and tasks scheduled for today"
          count={dueToday.length}
          items={dueToday}
          {...cardProps}
        />
      ) : null}

      {lists.waitingAndStarted.length > 0 ? (
        <section
          id="today-waiting"
          className="my-work-feed__group my-work-feed__group--waiting today-jump-target scroll-mt-4"
        >
          <div
            className="my-work-feed__group-head my-work-feed__group-head--collapsible"
            role="button"
            tabIndex={0}
            aria-expanded={waitingOpen}
            onClick={() => setWaitingOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setWaitingOpen((open) => !open);
              }
            }}
          >
            <span className="my-work-feed__tone my-work-feed__tone--waiting" aria-hidden />
            <div className="my-work-feed__group-copy">
              <h3 className="my-work-feed__group-title">Waiting/Started</h3>
              <p className="my-work-feed__group-hint">
                {waitingOpen
                  ? `${lists.waitingAndStarted.length} in progress`
                  : "In progress — expand when you need to follow up"}
              </p>
            </div>
            <span className="my-work-feed__count">{lists.waitingAndStarted.length}</span>
            <span className="my-work-feed__toggle no-print">{waitingOpen ? "Hide" : "Show"}</span>
          </div>
          <ul className={`my-work-list ${waitingOpen ? "" : "my-work-list--collapsed"}`.trim()}>
            {lists.waitingAndStarted.map((item, index) => {
              const key = officeItemKey(item, index);
              return (
                <MyWorkListRow
                  key={key}
                  item={item}
                  allItems={allItems}
                  toggling={togglingKey === key}
                  prepChecklistCreating={prepChecklistCreatingKey === key}
                  onToggleDone={onToggleDone}
                  onSetStatus={onSetStatus}
                  onResetWithDate={onResetWithDate}
                  onDeleteItem={onDeleteItem}
                  onUpdateNextAction={onUpdateNextAction}
                  onTogglePrepChecklistItem={onTogglePrepChecklistItem}
                  onMutatePrepChecklistItem={onMutatePrepChecklistItem}
                  onCreatePrepChecklist={onCreatePrepChecklist}
                  onInitializePrepChecklist={onInitializePrepChecklist}
                  onSaveEdit={onSaveEdit}
                  onCourtConfirmed={onCourtConfirmed}
                  onMarkSubmitted={onMarkSubmitted}
                  onConfirmParentFiled={onConfirmParentFiled}
                  onScheduleEmailSent={onScheduleEmailSent}
                  onItemStatus={onItemStatus}
                  formOptions={formOptions}
                  viewerStaffName={viewerStaffName}
                  viewerPrepRole={viewerPrepRole}
                  roster={roster}
                />
              );
            })}
          </ul>
        </section>
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
              <h3 className="my-work-feed__group-title">Completed today</h3>
              <p className="my-work-feed__group-hint">
                {lists.doneToday.length === 0
                  ? "Nothing completed yet today"
                  : doneOpen
                    ? `${lists.doneToday.length} completed today`
                    : `${lists.doneToday.length} completed — tap to review`}
              </p>
            </div>
            <span className="my-work-feed__count">{lists.doneToday.length}</span>
            {lists.doneToday.length > 0 ? (
              <span className="my-work-feed__toggle no-print">{doneOpen ? "Hide" : "Show"}</span>
            ) : null}
          </div>
          {lists.doneToday.length > 0 ? (
            <ul className={`my-work-list ${doneOpen ? "" : "my-work-list--collapsed"}`.trim()}>
              {lists.doneToday.map((item, index) => {
                const key = officeItemKey(item, index);
                return (
                  <MyWorkListRow
                    key={key}
                    item={item}
                    toggling={togglingKey === key}
                    onToggleDone={onToggleDone}
                    onSetStatus={onSetStatus}
                    onResetWithDate={onResetWithDate}
                    onDeleteItem={onDeleteItem}
                    onUpdateNextAction={onUpdateNextAction}
                    onTogglePrepChecklistItem={onTogglePrepChecklistItem}
                    onMutatePrepChecklistItem={onMutatePrepChecklistItem}
                    onSaveEdit={onSaveEdit}
                    onCourtConfirmed={onCourtConfirmed}
                    onMarkSubmitted={onMarkSubmitted}
                    onConfirmParentFiled={onConfirmParentFiled}
                    formOptions={formOptions}
                    viewerStaffName={viewerStaffName}
                    viewerPrepRole={viewerPrepRole}
                    roster={roster}
                  />
                );
              })}
            </ul>
          ) : null}
        </section>
    </div>
  );
}

function FeedGroup({
  id,
  tone,
  label,
  hint,
  count,
  items,
  allItems,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onScheduleEmailSent,
  onItemStatus,
  formOptions,
  togglingKey,
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: {
  id: string;
  tone: "overdue" | "waiting" | "due";
  label: string;
  hint: string;
  count: number;
  items: OfficeItem[];
  allItems: OfficeItem[];
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
  viewerStaffName?: string;
  viewerPrepRole?: import("@/lib/office-tasks/prep-workload-view").PrepWorkloadViewRole;
  roster?: string[];
} & WorkItemFilingActionProps) {
  return (
    <section
      id={id}
      className={`my-work-feed__group my-work-feed__group--${tone} today-jump-target scroll-mt-4`}
    >
      <div className="my-work-feed__group-head">
        <span className={`my-work-feed__tone my-work-feed__tone--${tone}`} aria-hidden />
        <div className="my-work-feed__group-copy">
          <h3 className="my-work-feed__group-title">{label}</h3>
          <p className="my-work-feed__group-hint">{hint}</p>
        </div>
        <span className="my-work-feed__count">{count}</span>
      </div>
      <ul className="my-work-list">
        {items.map((item, index) => {
          const key = officeItemKey(item, index);
          return (
            <MyWorkListRow
              key={key}
              item={item}
              allItems={allItems}
              toggling={togglingKey === key}
              prepChecklistCreating={prepChecklistCreatingKey === key}
              onToggleDone={onToggleDone}
              onSetStatus={onSetStatus}
              onResetWithDate={onResetWithDate}
              onDeleteItem={onDeleteItem}
              onUpdateNextAction={onUpdateNextAction}
              onTogglePrepChecklistItem={onTogglePrepChecklistItem}
              onMutatePrepChecklistItem={onMutatePrepChecklistItem}
              onCreatePrepChecklist={onCreatePrepChecklist}
              onInitializePrepChecklist={onInitializePrepChecklist}
              onSaveEdit={onSaveEdit}
              onCourtConfirmed={onCourtConfirmed}
              onMarkSubmitted={onMarkSubmitted}
              onConfirmParentFiled={onConfirmParentFiled}
              onScheduleEmailSent={onScheduleEmailSent}
              onItemStatus={onItemStatus}
              formOptions={formOptions}
              viewerStaffName={viewerStaffName}
              viewerPrepRole={viewerPrepRole}
              roster={roster}
            />
          );
        })}
      </ul>
    </section>
  );
}
