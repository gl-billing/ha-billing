"use client";

import { useMemo, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { EmptyState, ToneLegend, ViewHero } from "@/components/office-tasks/PremiumUI";
import { ClientCaseLink } from "@/components/office-tasks/ClientCodeBadge";
import { isCancelledStatus, officeItemKey } from "@/lib/office-tasks/schedule";
import {
  filterItemsBySmartIntent,
  formatSmartSearchLabel,
  parseSmartSearchQuery
} from "@/lib/smart-search-query";

type SourceFilter = "all" | "Task" | "Event";
type StatusFilter = "open" | "done" | "cancelled" | "all";

/** Cap rendered cards for very large sheets; filters/search narrow the list first. */
const RENDER_LIMIT = 500;

type Props = {
  items: OfficeItem[];
  employees: string[];
  query?: string;
  busy: boolean;
  togglingKey: string | null;
  onQueryChange?: (query: string) => void;
  onSearch: (query: string) => void;
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
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
} & WorkItemFilingActionProps;

export function SearchView({
  items,
  employees,
  query = "",
  busy,
  togglingKey,
  onQueryChange,
  onSearch,
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
  formOptions
}: Props) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "client">("date");

  const trimmedQuery = query.trim();
  const hasQuery = Boolean(trimmedQuery);
  const intent = useMemo(
    () => parseSmartSearchQuery(trimmedQuery, employees),
    [trimmedQuery, employees]
  );
  const intentLabel = formatSmartSearchLabel(intent);

  const { results, matchCount } = useMemo(() => {
    const q = trimmedQuery.toLowerCase();

    let list = [...items];

    if (sourceFilter !== "all") {
      list = list.filter((item) => item.source === sourceFilter);
    }

    if (statusFilter === "open") {
      list = list.filter(
        (item) =>
          !isCancelledStatus(item.status) &&
          !item.done &&
          item.status !== "Done" &&
          item.status !== "Submitted"
      );
    } else if (statusFilter === "done") {
      list = list.filter((item) => item.done || item.status === "Done" || item.status === "Submitted");
    } else if (statusFilter === "cancelled") {
      list = list.filter((item) => isCancelledStatus(item.status));
    }

    if (assigneeFilter) {
      const target = assigneeFilter.toLowerCase();
      list = list.filter((item) =>
        String(item.assignedTo || "")
          .toLowerCase()
          .includes(target)
      );
    }

    if (intent.parsed) {
      list = filterItemsBySmartIntent(list, intent, employees);
    } else if (q) {
      list = list.filter((item) => {
        const haystack = [
          item.source,
          item.id,
          item.clientCase,
          item.assignedTo,
          item.category,
          item.priority,
          item.venue,
          item.details,
          item.previousAction,
          item.nextAction,
          item.status,
          item.remarks
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    const priorityOrder = ["Urgent", "High", "Medium", "Low"];
    list.sort((a, b) => {
      if (sortBy === "client") return a.clientCase.localeCompare(b.clientCase);
      if (sortBy === "priority") {
        return (
          priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) ||
          (b.date || "").localeCompare(a.date || "")
        );
      }
      const aDate = a.date || "";
      const bDate = b.date || "";
      if (!aDate && !bDate) {
        return b.id.localeCompare(a.id) || b.rowNumber - a.rowNumber;
      }
      if (!aDate) return 1;
      if (!bDate) return -1;
      return bDate.localeCompare(aDate) || a.clientCase.localeCompare(b.clientCase);
    });

    const matchCount = list.length;
    return { results: list.slice(0, RENDER_LIMIT), matchCount };
  }, [items, trimmedQuery, sourceFilter, statusFilter, assigneeFilter, sortBy, intent, employees]);

  const truncated = matchCount > results.length;

  const grouped = useMemo(() => {
    const map = new Map<string, OfficeItem[]>();
    results.forEach((item) => {
      const key = item.clientCase?.trim() || "(No client / case)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  function clearFilters() {
    onQueryChange?.("");
    setSourceFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("");
    onSearch("");
  }

  return (
    <div className="search-page">
      <ViewHero
        eyebrow={hasQuery ? "Search results" : "Master list"}
        title={hasQuery ? "Refine results" : "All tasks & events"}
        subtitle={
          hasQuery
            ? intentLabel
              ? `Showing ${intentLabel}. Adjust filters below or clear to browse everything.`
              : `Matches for “${trimmedQuery}”. Adjust filters below or clear to browse everything.`
            : "Full list from your office sheet. Use the search bar above — try searching for a client, hearing date, task, or assignee."
        }
      />

      <section className="card mt-3 p-4 sm:p-5">
        <h3 className="section-label mb-4">Refine results</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <RefineSegment
            label="Type"
            value={sourceFilter}
            options={[
              ["all", "All"],
              ["Task", "Tasks"],
              ["Event", "Events"]
            ]}
            onChange={(v) => setSourceFilter(v as SourceFilter)}
          />
          <RefineSegment
            label="Status"
            value={statusFilter}
            options={[
              ["open", "Open"],
              ["done", "Done"],
              ["cancelled", "Cancelled"],
              ["all", "All"]
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <label className="refine-field">
            <span className="refine-field__label">Assignee</span>
            <select
              className="field-input field-input--compact mt-1.5"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="">Anyone</option>
              {employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="refine-field">
            <span className="refine-field__label">Sort by</span>
            <select
              className="field-input field-input--compact mt-1.5"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="date">Date</option>
              <option value="priority">Priority</option>
              <option value="client">Client / case</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
            Reset filters
          </button>
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">
          {truncated
            ? `${results.length} of ${matchCount} items`
            : `${results.length} item${results.length === 1 ? "" : "s"}`}
          {truncated ? " — use search or filters to narrow" : ""}
          {hasQuery ? ` · “${trimmedQuery}”` : ""}
        </p>
      </div>

      {!hasQuery && statusFilter === "all" && !assigneeFilter && sourceFilter === "all" && (
        <p className="mt-2 text-sm text-muted">Showing all tasks and events. Type in the search bar above to filter.</p>
      )}

      {results.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={items.length > 0 ? "Filters hide everything" : hasQuery ? "No matches" : "No items"}
            message={
              items.length > 0
                ? `${items.length} tasks and events loaded from your sheet, but none match the current search or filters. Reset filters or clear the search bar above.`
                : hasQuery
                  ? "Try another keyword or reset filters."
                  : "Your sheet has no tasks or events yet, or data could not load (check for a quota message above and wait 60 seconds, then Update)."
            }
          />
          {items.length > 0 ? (
            <div className="mt-4 flex justify-center">
              <button type="button" className="btn-primary max-w-[220px] text-sm" onClick={clearFilters}>
                Show all {items.length} items
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map(([client, clientItems]) => (
            <section key={client} className="result-group item-list-section">
              <ClientGroupHeader client={client} items={clientItems} />
              <ul className="item-list-section__items my-work-list my-work-panel--elegant">
                {clientItems.map((item, index) => {
                  const key = officeItemKey(item, index);
                  return (
                    <ItemCard
                      key={key}
                      item={item}
                      allItems={items}
                      onToggleDone={onToggleDone}
                      onSetStatus={onSetStatus}
                      onResetWithDate={onResetWithDate}
                      onDeleteItem={onDeleteItem}
                      onUpdateNextAction={onUpdateNextAction}
                      onTogglePrepChecklistItem={onTogglePrepChecklistItem}
                      onMutatePrepChecklistItem={onMutatePrepChecklistItem}
                      onCreatePrepChecklist={onCreatePrepChecklist}
                      onInitializePrepChecklist={onInitializePrepChecklist}
                      prepChecklistCreating={prepChecklistCreatingKey === key}
                      onSaveEdit={onSaveEdit}
                      onCourtConfirmed={onCourtConfirmed}
                      onMarkSubmitted={onMarkSubmitted}
                      onConfirmParentFiled={onConfirmParentFiled}
                      formOptions={formOptions}
                      toggling={togglingKey === key}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ToneLegend className="mt-6" />
    </div>
  );
}

function ClientGroupHeader({ client, items }: { client: string; items: OfficeItem[] }) {
  return (
    <h3 className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line/80 pb-2 font-display text-lg font-semibold text-ink">
      <span className="min-w-0 flex-1 truncate">
        <ClientCaseLink clientCase={client} className="client-group-title" />
      </span>
      <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 font-sans text-[10px] font-extrabold uppercase tracking-wide text-muted">
        {items.length}
      </span>
    </h3>
  );
}

function RefineSegment({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="refine-field__label">{label}</p>
      <div className="refine-segment" role="group" aria-label={label}>
        {options.map(([id, text]) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={`refine-segment__btn min-h-[44px] ${active ? "refine-segment__btn--active" : ""}`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
