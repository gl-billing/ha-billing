"use client";

import { useMemo } from "react";
import { AddTaskForm } from "@/components/office-tasks/AddEntryForm";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { MyWorkTodayFeed } from "@/components/office-tasks/MyWorkTodayFeed";
import { BillingTabGuide, BillingTabGuideText, TabPageHeader } from "@/components/BillingTabGuide";
import { TabPageBody } from "@/components/TabPageLayout";
import { ViewHero } from "@/components/office-tasks/PremiumUI";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { liaisonConfidentialItemsForViewer } from "@/lib/office-tasks/liaison-confidential";
import { computeTodayCounts, filterTodayLists } from "@/lib/office-tasks/today-lists";
import { formatDisplayDate } from "@/lib/office-tasks/date-only";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";

type Props = {
  items: OfficeItem[];
  today: string;
  isAdmin: boolean;
  staffName?: string;
  roster: string[];
  opts: EntryFormOptions;
  busy: boolean;
  togglingKey: string | null;
  onToggleDone: (item: ItemSummary, done: boolean) => void;
  onSetStatus: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction: (item: ItemSummary, nextAction: string) => void;
  onSaveEdit: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  onScheduleEmailSent?: (patch?: EventScheduleEmailSentPatch) => void;
  onSubmitConfidentialTask: (form: HTMLFormElement, clientCase: string) => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
} & WorkItemFilingActionProps;

export function LiaisonConfidentialPanel({
  items,
  today,
  isAdmin,
  staffName,
  roster,
  opts,
  busy,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onSaveEdit,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onScheduleEmailSent,
  onSubmitConfidentialTask,
  onStatus
}: Props) {
  const liaisonItems = useMemo(
    () =>
      liaisonConfidentialItemsForViewer(items, {
        isAdmin,
        staffName,
        roster
      }),
    [items, isAdmin, staffName, roster]
  );

  const counts = useMemo(() => computeTodayCounts(liaisonItems), [liaisonItems]);
  const lists = useMemo(() => filterTodayLists(liaisonItems), [liaisonItems]);

  return (
    <div className="page-stagger">
      <TabPageHeader resetKey="liaison">
        <BillingTabGuide title="Confidential liaison assignments">
          <BillingTabGuideText>
            Admin-only channel for sensitive instructions to the liaison officer. These tasks do not appear on My
            work, calendar, or search for other staff.
          </BillingTabGuideText>
          {isAdmin ? (
            <BillingTabGuideText>
              Use the form below to assign a confidential task. It is routed to the liaison officer automatically.
            </BillingTabGuideText>
          ) : (
            <BillingTabGuideText>
              Check off items when complete. Contact admin if you need clarification on an assignment.
            </BillingTabGuideText>
          )}
        </BillingTabGuide>
      </TabPageHeader>

      <TabPageBody>
        <ViewHero
          className="tab-view-hero liaison-confidential-hero"
          eyebrow="Confidential"
          title="Liaison assignments"
          subtitle={
            isAdmin
              ? "Private tasks for the liaison officer — not visible elsewhere in Schedule."
              : "Your confidential assignments from admin."
          }
        />

        {isAdmin ? (
          <section className="card liaison-confidential-form mb-4">
            <header className="liaison-confidential-form__head">
              <h2 className="liaison-confidential-form__title">New confidential assignment</h2>
              <p className="liaison-confidential-form__lede">
                Assigned to the liaison officer · not synced to shared calendar
              </p>
            </header>
            <AddTaskForm
              options={opts}
              busy={busy}
              billingAccess={false}
              onSubmit={onSubmitConfidentialTask}
              onStatus={onStatus}
            />
          </section>
        ) : null}

        <section className="card my-work-feed liaison-confidential-feed">
          <header className="my-work-feed__head">
            <div>
              <p className="my-work-feed__eyebrow">Private checklist</p>
              <h2 className="my-work-feed__title">{formatDisplayDate(today)}</h2>
              <p className="my-work-feed__lede">
                {liaisonItems.length === 0
                  ? "No confidential assignments on file."
                  : `${counts.overdueOpen + counts.tasksDueToday + counts.eventsToday + counts.deadlinesToday + counts.dueThisWeek} open · ${counts.completedToday} completed today`}
              </p>
            </div>
          </header>

          <MyWorkTodayFeed
            lists={{
              overdue: lists.overdue,
              eventsToday: lists.eventsToday,
              deadlinesToday: lists.deadlinesToday,
              tasksDueToday: lists.tasksDueToday,
              dueThisWeek: lists.dueThisWeek,
              doneToday: lists.doneToday
            }}
            allItems={liaisonItems}
            onToggleDone={onToggleDone}
            onSetStatus={onSetStatus}
            onResetWithDate={onResetWithDate}
            onDeleteItem={onDeleteItem}
            onUpdateNextAction={onUpdateNextAction}
            onSaveEdit={onSaveEdit}
            onCourtConfirmed={onCourtConfirmed}
            onMarkSubmitted={onMarkSubmitted}
            onConfirmParentFiled={onConfirmParentFiled}
            formOptions={opts}
            togglingKey={togglingKey}
            isAdmin={isAdmin}
            roster={roster}
            onScheduleEmailSent={onScheduleEmailSent}
            onItemStatus={onStatus}
          />
        </section>
      </TabPageBody>
    </div>
  );
}
