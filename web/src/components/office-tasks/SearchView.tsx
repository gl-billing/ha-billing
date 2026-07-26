"use client";

import { Fragment, useMemo, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { EmptyState, ToneLegend } from "@/components/office-tasks/PremiumUI";
import { ClientCaseLink } from "@/components/office-tasks/ClientCodeBadge";
import { eventVenueDisplay } from "@/lib/office-tasks/event-join-link";
import { formatDisplayDate } from "@/lib/office-tasks/date-only";
import {
  isCancelledStatus,
  itemTone,
  myWorkItemKindLabel,
  officeItemKey,
  todayYmd,
  truncate
} from "@/lib/office-tasks/schedule";
import {
  filterItemsBySmartIntent,
  formatSmartSearchLabel,
  parseSmartSearchQuery
} from "@/lib/smart-search-query";

type SourceFilter = "all" | "Task" | "Event";
type StatusFilter = "open" | "done" | "cancelled" | "all";

/** Cap rendered rows for very large sheets; filters/search narrow the list first. */
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
  busy: _busy,
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const hasQuery = Boolean(trimmedQuery);
  const intent = useMemo(
    () => parseSmartSearchQuery(trimmedQuery, employees),
    [trimmedQuery, employees]
  );
  const intentLabel = formatSmartSearchLabel(intent);
  const today = todayYmd();

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

  function clearFilters() {
    onQueryChange?.("");
    setSourceFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("");
    setExpandedKey(null);
    onSearch("");
  }

  function toggleExpand(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="search-page space-tasks-ledger">
      <header className="space-tasks-ledger__head">
        <h3 className="space-tasks-ledger__title">
          {hasQuery ? "Search results" : "All tasks & events"}
        </h3>
        <p className="space-tasks-ledger__lede">
          {hasQuery
            ? intentLabel
              ? `Showing ${intentLabel}. Adjust filters below or clear to browse everything.`
              : `Matches for “${trimmedQuery}”. Adjust filters below or clear to browse everything.`
            : "Search or filter the ledger, then open a row for actions."}
        </p>
      </header>

      <section className="space-tasks-ledger__filters mt-3">
        <h3 className="section-label mb-3">Refine results</h3>
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="space-tasks-ledger__count">
            {truncated
              ? `${results.length} of ${matchCount} items`
              : `${results.length} item${results.length === 1 ? "" : "s"}`}
            {truncated ? " — use search or filters to narrow" : ""}
            {hasQuery ? ` · “${trimmedQuery}”` : ""}
          </p>
          <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
            Reset filters
          </button>
        </div>
      </section>

      {!hasQuery && statusFilter === "all" && !assigneeFilter && sourceFilter === "all" ? (
        <p className="mt-2 text-sm text-muted">
          Showing all tasks and events. Type in the search bar above to filter.
        </p>
      ) : null}

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
        <div className="space-tasks-ledger__table-wrap firm-ledger-table-wrap mt-4">
          <table className="space-tasks-ledger__table firm-ledger-table w-full text-left">
            <thead>
              <tr>
                <th scope="col" className="space-tasks-ledger__col-type">
                  Type
                </th>
                <th scope="col" className="space-tasks-ledger__col-matter">
                  Matter
                </th>
                <th scope="col" className="space-tasks-ledger__col-details">
                  Details
                </th>
                <th scope="col" className="space-tasks-ledger__col-date">
                  Date
                </th>
                <th scope="col" className="space-tasks-ledger__col-status">
                  Status
                </th>
                <th scope="col" className="space-tasks-ledger__col-assignee">
                  Assignee
                </th>
                <th scope="col" className="space-tasks-ledger__col-venue">
                  Venue
                </th>
                <th scope="col" className="space-tasks-ledger__col-category">
                  Category
                </th>
                <th scope="col" className="space-tasks-ledger__col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {results.map((item, index) => {
                const key = officeItemKey(item, index);
                const expanded = expandedKey === key;
                const tone = itemTone(item, today);
                const kind = myWorkItemKindLabel(item);
                const venue = eventVenueDisplay(item.venue, null) || item.venue?.trim() || "—";
                const details =
                  truncate(item.details?.trim() || item.nextAction?.trim() || "—", 80);
                const dateLabel =
                  item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
                    ? formatDisplayDate(item.date, "register")
                    : item.date || "—";
                const statusLabel =
                  item.done || item.status === "Done" || item.status === "Submitted"
                    ? item.status === "Submitted"
                      ? "Submitted"
                      : "Done"
                    : isCancelledStatus(item.status)
                      ? "Cancelled"
                      : item.status?.trim() || "Open";

                return (
                  <Fragment key={key}>
                    <tr
                      className={`space-tasks-ledger__row space-tasks-ledger__row--${tone}${
                        expanded ? " space-tasks-ledger__row--expanded" : ""
                      }`}
                      onClick={() => toggleExpand(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(key);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={expanded}
                    >
                      <td className="space-tasks-ledger__type">
                        <span className={`space-tasks-ledger__kind space-tasks-ledger__kind--${tone}`}>
                          {kind}
                        </span>
                        <span className="space-tasks-ledger__source">{item.source}</span>
                      </td>
                      <td className="space-tasks-ledger__matter-cell">
                        <ClientCaseLink
                          clientCase={item.clientCase || "(No client / case)"}
                          className="space-tasks-ledger__matter"
                        />
                      </td>
                      <td className="space-tasks-ledger__details" title={item.details || ""}>
                        {details}
                      </td>
                      <td className="space-tasks-ledger__date">
                        {dateLabel}
                        {item.startTime ? (
                          <span className="space-tasks-ledger__time"> {item.startTime}</span>
                        ) : null}
                      </td>
                      <td className="space-tasks-ledger__status-cell">
                        <span className={`space-tasks-ledger__status space-tasks-ledger__status--${tone}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="space-tasks-ledger__assignee">{item.assignedTo?.trim() || "—"}</td>
                      <td className="space-tasks-ledger__venue" title={venue}>
                        {truncate(venue, 36)}
                      </td>
                      <td className="space-tasks-ledger__category">{item.category?.trim() || "—"}</td>
                      <td className="space-tasks-ledger__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm space-tasks-ledger__open-btn"
                          aria-expanded={expanded}
                          onClick={() => toggleExpand(key)}
                        >
                          {expanded ? "Close" : "Open"}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="space-tasks-ledger__detail-row">
                        <td colSpan={9}>
                          <ul className="item-list-section__items my-work-list my-work-panel--elegant space-tasks-ledger__detail">
                            <ItemCard
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
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ToneLegend className="mt-6" />
    </div>
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
