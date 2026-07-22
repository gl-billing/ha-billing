"use client";

import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import { DayScheduleView } from "@/components/office-tasks/DayScheduleView";
import { WeeklyPlannerView } from "@/components/office-tasks/WeeklyPlannerView";
import { BillingTabGuide, BillingTabGuideText, TabPageHeader } from "@/components/BillingTabGuide";
import { TabPageBody } from "@/components/TabPageLayout";

type Props = {
  calendarMode: "day" | "week" | "month";
  items: OfficeItem[];
  today: string;
  weekStart: string;
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

/** Calendar week tab — day hourly schedule or seven-day planner. */
export function TasksWeekTabView({
  calendarMode,
  items,
  today,
  weekStart,
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
  if (calendarMode === "day") {
    return (
      <>
        <TabPageHeader resetKey="day">
          <BillingTabGuide title="About day schedule">
            <BillingTabGuideText>
              Hourly lanes for one day — hearings and meetings with start times, plus untimed items.
            </BillingTabGuideText>
            <BillingTabGuideText>
              Switch to <strong>Week</strong> or <strong>Month</strong> in the left rail for a wider view.
            </BillingTabGuideText>
          </BillingTabGuide>
        </TabPageHeader>
        <TabPageBody>
          <DayScheduleView
            items={items}
            today={today}
            initialDate={today}
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
        </TabPageBody>
      </>
    );
  }

  return (
    <>
      <TabPageHeader resetKey="week">
        <BillingTabGuide title="Week planner">
          <BillingTabGuideText>
            See the next seven days in a grid — overdue items at the top, then each day&apos;s work. Select a day for
            details below. Best when planning ahead for the week.
          </BillingTabGuideText>
          <BillingTabGuideText>
            For today&apos;s priority list, use <strong>My work</strong>.
          </BillingTabGuideText>
        </BillingTabGuide>
      </TabPageHeader>
      <TabPageBody>
        <WeeklyPlannerView
          items={items}
          today={today}
          initialWeekStart={weekStart}
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
      </TabPageBody>
    </>
  );
}
