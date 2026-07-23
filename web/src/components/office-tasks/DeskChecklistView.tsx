"use client";

import { useState } from "react";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { DeskChecklistItemRow } from "@/components/office-tasks/DeskChecklistItemRow";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  buildDeskChecklistSections,
  reorderDeskChecklistByMatter,
  type DeskChecklistOpenBucket,
  type DeskChecklistScope
} from "@/lib/office-tasks/desk-checklist";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import { formatDisplayDate, todayYmd } from "@/lib/office-tasks/date-only";
import type { EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";

const OPEN_SECTION_STYLES: Record<
  DeskChecklistOpenBucket,
  { chip: string; panel: string; title: string }
> = {
  needsOutcome: {
    chip: "bg-orange-100 text-orange-950 border-orange-200",
    panel: "border-orange-200/80 bg-orange-50/45",
    title: "text-orange-950"
  },
  overdue: {
    chip: "bg-red-100 text-red-900 border-red-200",
    panel: "border-red-200/80 bg-red-50/40",
    title: "text-red-950"
  },
  dueToday: {
    chip: "bg-amber-100 text-amber-950 border-amber-200",
    panel: "border-amber-200/80 bg-amber-50/50",
    title: "text-amber-950"
  },
  dueThisWeek: {
    chip: "bg-sky-100 text-sky-950 border-sky-200",
    panel: "border-sky-200/80 bg-sky-50/40",
    title: "text-sky-950"
  }
};

const WAITING_SECTION_STYLES = {
  chip: "bg-violet-100 text-violet-900 border-violet-200",
  panel: "border-violet-200/80 bg-violet-50/35",
  title: "text-violet-950"
};

const MUTED_SECTION_STYLES = {
  chip: "bg-line/30 text-muted border-line/70",
  panel: "border-line/70 bg-[#f8f7f5]",
  title: "text-muted"
};

const COLLAPSIBLE_INITIAL_VISIBLE = 5;

type CollapsibleSectionId = "cancelledPostponed" | "completed";

type Props = {
  items: OfficeItem[];
  allItems: OfficeItem[];
  staffName: string;
  togglingKey: string | null;
  onToggleDone: (item: ItemSummary, done: boolean) => void;
  onMarkPrepDone?: (item: ItemSummary) => void;
  onMarkLetterDocDone?: (item: ItemSummary) => void;
  onSetStatus: (item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) => void;
  onResetWithDate: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction: (item: ItemSummary, nextAction: string) => void;
  onLogAppearanceOutcome?: (
    item: ItemSummary,
    payload: {
      action: "completed" | "rescheduled" | "postponed" | "cancelled";
      whatHappened: string;
      nextDate?: string;
      createNextDateFollowUp: boolean;
      courtFollowUpKind?: "none" | "next_hearing" | "submission" | "other";
      followUpDate?: string;
      followUpNote?: string;
    }
  ) => void | Promise<void>;
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
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
  billingAccess?: boolean;
  testLab?: boolean;
  trialWorkspace?: boolean;
  navProfile?: "secretary" | "tasks-only" | "full";
  checklistScope?: DeskChecklistScope;
  isAdmin?: boolean;
} & WorkItemFilingActionProps;

export function DeskChecklistView({
  items,
  allItems,
  staffName,
  togglingKey,
  onToggleDone,
  onMarkPrepDone,
  onMarkLetterDocDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onLogAppearanceOutcome,
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
  viewerStaffName,
  viewerPrepRole,
  roster = [],
  billingAccess,
  testLab = false,
  trialWorkspace = false,
  checklistScope = "firm",
  isAdmin = false
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<CollapsibleSectionId, boolean>>({
    cancelledPostponed: false,
    completed: false
  });
  const today = todayYmd();
  const sections = buildDeskChecklistSections(items, today);
  const openSections = sections.filter(
    (section): section is (typeof sections)[number] & { id: DeskChecklistOpenBucket } =>
      section.id === "needsOutcome" ||
      section.id === "overdue" ||
      section.id === "dueToday" ||
      section.id === "dueThisWeek"
  );
  const waitingSection = sections.find((section) => section.id === "waitingOnClient");
  const cancelledSection = sections.find((section) => section.id === "cancelledPostponed");
  const completedSection = sections.find((section) => section.id === "completed");
  const openCount = openSections.reduce((sum, section) => sum + section.items.length, 0);
  const waitingItems = waitingSection?.items ?? [];
  const cancelledItems = cancelledSection?.items ?? [];
  const completedItems = completedSection?.items ?? [];
  const canToggleItems = checklistScope === "firm" ? isAdmin || Boolean(staffName) : Boolean(staffName);

  const checklistRowProps = {
    allItems,
    togglingKey,
    prepChecklistCreatingKey,
    canToggleItems,
    onToggleDone,
    onMarkPrepDone,
    onMarkLetterDocDone,
    onSetStatus,
    onResetWithDate,
    onDeleteItem,
    onUpdateNextAction,
    onLogAppearanceOutcome,
    onTogglePrepChecklistItem,
    onMutatePrepChecklistItem,
    onCreatePrepChecklist,
    onInitializePrepChecklist,
    onSaveEdit,
    onCourtConfirmed,
    onMarkSubmitted,
    onConfirmParentFiled,
    onScheduleEmailSent,
    onItemStatus,
    formOptions,
    viewerStaffName,
    viewerPrepRole,
    roster,
    billingAccess
  };

  function renderChecklistRow(
    item: OfficeItem,
    options: { muted?: boolean; inactive?: boolean } = {}
  ) {
    return (
      <DeskChecklistItemRow
        key={officeItemKey(item)}
        item={item}
        options={options}
        {...checklistRowProps}
      />
    );
  }

  function toggleCollapsibleSection(sectionId: CollapsibleSectionId) {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }

  function renderCollapsibleSection(
    sectionId: CollapsibleSectionId,
    title: string,
    hint: string,
    countLabel: string,
    sectionItems: OfficeItem[],
    rowOptions: { muted: boolean; inactive?: boolean }
  ) {
    if (!sectionItems.length) return null;

    const expanded = expandedSections[sectionId];
    const hiddenCount = Math.max(0, sectionItems.length - COLLAPSIBLE_INITIAL_VISIBLE);
    const visibleItems = expanded ? sectionItems : sectionItems.slice(0, COLLAPSIBLE_INITIAL_VISIBLE);

    return (
      <section
        key={sectionId}
        className={`card border p-3 sm:p-4 ${MUTED_SECTION_STYLES.panel}`}
        aria-labelledby={`desk-checklist-${sectionId}`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3
              id={`desk-checklist-${sectionId}`}
              className={`text-sm font-bold uppercase tracking-wide ${MUTED_SECTION_STYLES.title}`}
            >
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-muted">{hint}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${MUTED_SECTION_STYLES.chip}`}>
            {sectionItems.length} {countLabel}
          </span>
        </div>
        <ul className="desk-checklist__list">
          {reorderDeskChecklistByMatter(visibleItems).map((item) => renderChecklistRow(item, rowOptions))}
        </ul>
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line/70 bg-white/70 px-3 py-2 text-xs font-bold text-muted transition hover:border-gold/35 hover:bg-white hover:text-ink"
            aria-expanded={expanded}
            onClick={() => toggleCollapsibleSection(sectionId)}
          >
            <span>{expanded ? "Show less" : `Show more (${hiddenCount})`}</span>
            <span
              className={`text-[10px] leading-none transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            >
              ▼
            </span>
          </button>
        ) : null}
      </section>
    );
  }

  const hasAnyItems =
    openCount > 0 ||
    waitingItems.length > 0 ||
    cancelledItems.length > 0 ||
    completedItems.length > 0;

  return (
    <div className="page-stagger desk-checklist">
      <section className="card mb-4 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gold-dark">Desk checklist</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">{formatDisplayDate(today, "short")}</h2>
        <p className="mt-2 text-sm text-muted">
          {checklistScope === "firm" ? (
            <>
              Firm-wide desk checklist — needs outcome, overdue, due today, and due this week for{" "}
              <strong className="text-ink">all assignees</strong>. Check to mark done; tap the case name for details or
              the client name for the matter window. Use <strong className="text-ink">What happened</strong> on past
              hearings and meetings.
            </>
          ) : staffName ? (
            <>
              Simple checklist for <strong className="text-ink">{staffName}</strong> — check to mark done, tap the case
              name for details, or the client name for the matter window.
            </>
          ) : (
            "Match your Google sign-in to a name on the Employees sheet to see your checklist."
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          {openCount ? `${openCount} open item${openCount === 1 ? "" : "s"}` : "All caught up for this view."}
        </p>
      </section>

      <div className="space-y-4">
        {openSections.map((section) => {
          const styles = OPEN_SECTION_STYLES[section.id];
          if (!section.items.length) return null;

          return (
            <section
              key={section.id}
              className={`card border p-3 sm:p-4 ${styles.panel}`}
              aria-labelledby={`desk-checklist-${section.id}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3
                    id={`desk-checklist-${section.id}`}
                    className={`text-sm font-bold uppercase tracking-wide ${styles.title}`}
                  >
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">{section.hint}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.chip}`}>
                  {section.items.length} open
                </span>
              </div>

              <ul className="desk-checklist__list">
                {reorderDeskChecklistByMatter(section.items).map((item) => renderChecklistRow(item))}
              </ul>
            </section>
          );
        })}

        {waitingItems.length ? (
          <section
            className={`card border p-3 sm:p-4 ${WAITING_SECTION_STYLES.panel}`}
            aria-labelledby="desk-checklist-waitingOnClient"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3
                  id="desk-checklist-waitingOnClient"
                  className={`text-sm font-bold uppercase tracking-wide ${WAITING_SECTION_STYLES.title}`}
                >
                  {waitingSection?.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{waitingSection?.hint}</p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${WAITING_SECTION_STYLES.chip}`}
              >
                {waitingItems.length} waiting
              </span>
            </div>
            <ul className="desk-checklist__list">
              {reorderDeskChecklistByMatter(waitingItems).map((item) => renderChecklistRow(item))}
            </ul>
          </section>
        ) : null}

        {renderCollapsibleSection(
          "cancelledPostponed",
          cancelledSection?.title ?? "Cancelled / postponed",
          cancelledSection?.hint ?? "",
          "inactive",
          cancelledItems,
          { muted: true, inactive: true }
        )}

        {renderCollapsibleSection(
          "completed",
          completedSection?.title ?? "Completed",
          completedSection?.hint ?? "",
          "done",
          completedItems,
          { muted: true }
        )}
      </div>

      {!hasAnyItems ? (
        <section className="card p-6 text-center text-sm text-muted">
          {checklistScope === "firm"
            ? "No tasks or events are due this week across the firm."
            : staffName
              ? "No assigned tasks or events are due this week."
              : "Your checklist will appear once your account matches an employee on the roster."}
        </section>
      ) : null}
    </div>
  );
}
