"use client";

import { useMemo, useState } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { EmployeeAvatar, EmptyState, ProgressRing, StatTile, ViewHero } from "@/components/office-tasks/PremiumUI";
import { StaffRemindersPanel } from "@/components/office-tasks/StaffRemindersPanel";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { buildEmployeeRoleLookup } from "@/lib/office-tasks/employee-role-lookup";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { WorkItemFilingActionProps } from "@/lib/office-tasks/work-item-filing-actions";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { EmployeeItemGroups, EmployeeStat } from "@/lib/office-tasks/schedule";
import { formatDisplayDate, getEmployeeItemGroups, getTeamEmployeeView, officeItemKey, sortTeamWorkloadStats } from "@/lib/office-tasks/schedule";
import { resolveFirmOwnerAssignee, canonicalizeStaffName } from "@/lib/staff-assignee";
import { openPrintPreview } from "@/lib/print-preview";

type Props = {
  stats: EmployeeStat[];
  items: OfficeItem[];
  today: string;
  weekDates: string[];
  employeeDirectory: EmployeeRecord[];
  isAdmin: boolean;
  busy: boolean;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  onStatus: (msg: string) => void;
} & WorkItemFilingActionProps;

export function EmployeeTrackerView({
  stats,
  items,
  today,
  weekDates,
  employeeDirectory,
  isAdmin,
  busy,
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
  formOptions,
  togglingKey,
  onStatus
}: Props) {
  const roster = useMemo(
    () => employeeDirectory.map((employee) => employee.name).filter(Boolean),
    [employeeDirectory]
  );

  const sortedStats = useMemo(() => sortTeamWorkloadStats(stats, roster), [stats, roster]);

  const roleByName = useMemo(
    () => buildEmployeeRoleLookup(employeeDirectory, roster, canonicalizeStaffName),
    [employeeDirectory, roster]
  );

  const roleForName = (name: string) =>
    roleByName.get(canonicalizeStaffName(name, roster).trim().toLowerCase()) ||
    roleByName.get(name.trim().toLowerCase()) ||
    "";

  const [selectedName, setSelectedName] = useState<string | null>(sortedStats[0]?.name || null);

  const fullGroups = useMemo(() => {
    if (!selectedName) return null;
    return getEmployeeItemGroups(selectedName, items, today, weekDates, roster);
  }, [selectedName, items, today, weekDates, roster]);

  const splitView = useMemo(() => {
    if (!selectedName) return null;
    return getTeamEmployeeView(selectedName, items, today, weekDates, roster);
  }, [selectedName, items, today, weekDates, roster]);

  const groups = splitView?.client ?? null;
  const taxGroups = splitView?.taxCompliance ?? null;
  const adminGroups = splitView?.adminTasks ?? null;
  const operationsGroups = splitView?.operations ?? null;
  const firmOwner = resolveFirmOwnerAssignee(roster);
  const isFirmOwnerView = Boolean(
    firmOwner &&
      selectedName &&
      canonicalizeStaffName(selectedName, roster).trim().toLowerCase() === firmOwner.trim().toLowerCase()
  );
  const isAndreaView = Boolean(operationsGroups);

  const selectedStat = sortedStats.find((s) => s.name === selectedName);
  const checklistSectionProps = {
    allItems: items,
    onTogglePrepChecklistItem,
    onMutatePrepChecklistItem,
    onCreatePrepChecklist,
  onInitializePrepChecklist,
    prepChecklistCreatingKey
  };

  if (!sortedStats.length) {
    return (
      <EmptyState
        title="No team workload yet"
        message="Add staff on the Employees sheet and assign tasks — workload cards will appear here."
      />
    );
  }

  return (
    <div id="print-team" className="print-root">
      <FirmPrintLetterhead
        onlyPrint
        documentType="Staff load"
        documentTitle="Staff workload"
        documentSubtitle={selectedName ? selectedName : undefined}
      />
      <ViewHero
        eyebrow="Staff load"
        title="Staff workload"
        subtitle="Select a team member to review every assignment — grouped by open, today, this week, and overdue."
        action={
          <button
            type="button"
            className="btn-primary max-w-[160px] shrink-0 px-4 py-2 text-xs"
            onClick={() => openPrintPreview({ title: "HA Office Employee Tracker", sourceId: "print-team" })}
          >
            Print
          </button>
        }
      />

      <div className="no-print grid gap-3 sm:grid-cols-2">
        {sortedStats.map((row) => {
          const active = selectedName === row.name;
          const roleLabel = roleForName(row.name);
          return (
            <button
              key={row.name}
              type="button"
              onClick={() => setSelectedName(row.name)}
              className={`employee-card border p-4 text-left ${
                active ? "employee-card--active border-ink" : "border-line/80 bg-white hover:border-ink/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={row.name} />
                <div className="min-w-0 flex-1">
                  <span className="font-display text-lg font-semibold text-ink">{row.name}</span>
                  {roleLabel ? <p className="employee-card__role">{roleLabel}</p> : null}
                  <p className="text-[11px] font-semibold text-muted">
                    {row.open} open · {row.overdue > 0 ? `${row.overdue} overdue` : "on track"}
                  </p>
                </div>
                <ProgressRing percent={row.completionRate} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 lg:grid-cols-5 lg:gap-1.5">
                <MiniStat label="Total" value={row.total} />
                <MiniStat label="Open" value={row.open} highlight={row.open > 0} />
                <MiniStat label="Today" value={row.dueToday} highlight={row.dueToday > 0} tone="amber" />
                <MiniStat label="Week" value={row.dueThisWeek} />
                <MiniStat label="Late" value={row.overdue} highlight={row.overdue > 0} tone="red" />
              </div>
            </button>
          );
        })}
      </div>

      {selectedName && selectedStat && fullGroups && groups && (
        <section className="employee-detail day-detail-panel mt-5 no-print">
          <div className="flex flex-wrap items-start gap-4 border-b border-line/80 pb-4">
            <EmployeeAvatar name={selectedName} />
            <div className="flex-1">
              <p className="view-eyebrow">Selected</p>
              <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">{selectedName}</h3>
              {roleForName(selectedName) ? (
                <p className="employee-card__role employee-card__role--detail">{roleForName(selectedName)}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {selectedStat.total} assignment{selectedStat.total === 1 ? "" : "s"} · as of {formatDisplayDate(today, "short")}
              </p>
            </div>
            <ProgressRing percent={selectedStat.completionRate} size={52} />
          </div>

          <StaffRemindersPanel
            layout="compact"
            items={items}
            today={today}
            weekDates={weekDates}
            directory={employeeDirectory}
            selectedAssignee={selectedName}
            isAdmin={isAdmin}
            busy={busy}
            onStatus={onStatus}
          />

          <div className="mt-4 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 lg:grid-cols-5">
            <StatTile label="All tasks" value={fullGroups.all.length} variant="gold" />
            <StatTile label="Open" value={fullGroups.open.length} variant="green" />
            <StatTile label="Due today" value={fullGroups.dueToday.length} variant={fullGroups.dueToday.length ? "gold" : "muted"} />
            <StatTile label="This week" value={fullGroups.dueThisWeek.length} variant="blue" />
            <StatTile label="Overdue" value={fullGroups.overdue.length} variant={fullGroups.overdue.length ? "red" : "muted"} />
          </div>

          <div className="mt-6 space-y-4">
            {isFirmOwnerView && taxGroups && adminGroups ? (
              <>
                <FirmTaskGroupSection
                  title="Tax compliance (BIR)"
                  description={`Assigned to you · ${taxGroups.open.length} open${taxGroups.overdue.length ? ` · ${taxGroups.overdue.length} overdue` : ""}`}
                  groups={taxGroups}
                  emptyText="No tax compliance items — use Tools → BIR tracker to add filing deadlines."
                  border="border-amber-500/70"
                  accentClass="firm-task-group--tax"
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
                  {...checklistSectionProps}
                />
                <FirmTaskGroupSection
                  title="Admin tasks"
                  description={`Owner/admin firm tasks · ${adminGroups.open.length} open${adminGroups.overdue.length ? ` · ${adminGroups.overdue.length} overdue` : ""}`}
                  groups={adminGroups}
                  emptyText="No admin tasks right now."
                  border="border-gold/50"
                  accentClass="firm-task-group--admin"
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
                  {...checklistSectionProps}
                />
                <div className="firm-task-group-divider">
                  <span className="firm-task-group-divider__label">Client matters</span>
                </div>
              </>
            ) : null}

            {isAndreaView && operationsGroups ? (
              <>
                <FirmTaskGroupSection
                  title="Billing & documents"
                  description={`SOA/AR, billing follow-ups, contracts & agreements, filing prep · ${operationsGroups.open.length} open${operationsGroups.overdue.length ? ` · ${operationsGroups.overdue.length} overdue` : ""}`}
                  groups={operationsGroups}
                  emptyText="No billing or document tasks right now."
                  border="border-blue-400/80"
                  accentClass="firm-task-group--admin"
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
                  {...checklistSectionProps}
                />
                <div className="firm-task-group-divider">
                  <span className="firm-task-group-divider__label">Court & client tasks</span>
                </div>
              </>
            ) : null}
            <EmployeeSection
              title="Open"
              description="Not yet marked done"
              items={groups.open}
              emptyText="No open items — great work."
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
              {...checklistSectionProps}
              border="border-green/50"
            />
            <EmployeeSection
              title="Due today"
              description="Scheduled for today"
              items={groups.dueToday}
              emptyText="Nothing due today."
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
              {...checklistSectionProps}
              border="border-amber-400"
            />
            <EmployeeSection
              title="Due this week"
              description="Monday–Sunday of the current work week"
              items={groups.dueThisWeek}
              emptyText="Nothing else due this week."
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
              {...checklistSectionProps}
              border="border-blue-400"
            />
            <EmployeeSection
              title="Overdue"
              description="Past due and still open"
              items={groups.overdue}
              emptyText="No overdue items."
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
              {...checklistSectionProps}
              border="border-red-400"
              collapsedDefault={!groups.overdue.length}
            />
            <EmployeeSection
              title="Completed"
              description="Marked done or submitted"
              items={groups.done}
              emptyText="No completed items."
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
              {...checklistSectionProps}
              border="border-gray-300"
              collapsedDefault
              showWhenEmpty={false}
            />
          </div>
        </section>
      )}

    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
  tone
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: "red" | "amber";
}) {
  const bg =
    highlight && tone === "red"
      ? "bg-red-50 text-red-800 ring-1 ring-red-200"
      : highlight && tone === "amber"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
        : highlight
          ? "bg-green/10 text-green ring-1 ring-green/20"
          : "bg-soft/90 text-ink";
  return (
    <div className={`rounded-lg py-2 text-center ${bg}`}>
      <div className="font-display text-base font-semibold">{value}</div>
      <div className="text-[8px] font-extrabold uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function FirmTaskGroupSection({
  title,
  description,
  groups,
  emptyText,
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
  formOptions,
  togglingKey,
  border,
  accentClass
}: {
  title: string;
  description: string;
  groups: EmployeeItemGroups;
  emptyText: string;
  allItems: OfficeItem[];
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  border: string;
  accentClass: string;
} & WorkItemFilingActionProps) {
  const itemKey = (item: OfficeItem) => `${item.source}-${item.rowNumber}`;
  const overdueKeys = new Set(groups.overdue.map(itemKey));
  const openItems = [...groups.overdue, ...groups.open.filter((item) => !overdueKeys.has(itemKey(item)))];

  return (
    <div className={`firm-task-group rounded-xl border border-line/80 bg-white/60 p-3 ${accentClass}`}>
      <EmployeeSection
        title={title}
        description={description}
        items={openItems}
        allItems={allItems}
        emptyText={emptyText}
        onToggleDone={onToggleDone}
        onSetStatus={onSetStatus}
        onResetWithDate={onResetWithDate}
        onDeleteItem={onDeleteItem}
        onUpdateNextAction={onUpdateNextAction}
        onTogglePrepChecklistItem={onTogglePrepChecklistItem}
        onMutatePrepChecklistItem={onMutatePrepChecklistItem}
        onCreatePrepChecklist={onCreatePrepChecklist}
        onInitializePrepChecklist={onInitializePrepChecklist}
        prepChecklistCreatingKey={prepChecklistCreatingKey}
        onSaveEdit={onSaveEdit}
        onCourtConfirmed={onCourtConfirmed}
        onMarkSubmitted={onMarkSubmitted}
        onConfirmParentFiled={onConfirmParentFiled}
        formOptions={formOptions}
        togglingKey={togglingKey}
        border={border}
      />
      {groups.done.length ? (
        <EmployeeSection
          title={`${title} — completed`}
          description="Filed or marked done"
          items={groups.done}
          allItems={allItems}
          emptyText=""
          onToggleDone={onToggleDone}
          onSetStatus={onSetStatus}
          onResetWithDate={onResetWithDate}
          onUpdateNextAction={onUpdateNextAction}
          onTogglePrepChecklistItem={onTogglePrepChecklistItem}
        onMutatePrepChecklistItem={onMutatePrepChecklistItem}
          onCreatePrepChecklist={onCreatePrepChecklist}
          onInitializePrepChecklist={onInitializePrepChecklist}
          prepChecklistCreatingKey={prepChecklistCreatingKey}
          onSaveEdit={onSaveEdit}
          onCourtConfirmed={onCourtConfirmed}
          onMarkSubmitted={onMarkSubmitted}
          onConfirmParentFiled={onConfirmParentFiled}
          formOptions={formOptions}
          togglingKey={togglingKey}
          border="border-gray-300"
          collapsedDefault
          showWhenEmpty={false}
        />
      ) : null}
    </div>
  );
}

function EmployeeSection({
  title,
  description,
  items,
  allItems,
  emptyText,
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
  formOptions,
  togglingKey,
  border,
  collapsedDefault,
  showWhenEmpty = true
}: {
  title: string;
  description: string;
  items: OfficeItem[];
  allItems: OfficeItem[];
  emptyText: string;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  togglingKey?: string | null;
  border: string;
  collapsedDefault?: boolean;
  showWhenEmpty?: boolean;
} & WorkItemFilingActionProps) {
  const [open, setOpen] = useState(!collapsedDefault);

  if (!items.length && !showWhenEmpty) return null;

  const toggleLabel = open ? "Hide" : `Show (${items.length})`;

  return (
    <div className={`bucket-section border-l-4 ${border}`}>
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <div>
          <h4 className="font-display text-base font-semibold text-ink">
            {title} <span className="text-sm font-sans font-bold text-muted">({items.length})</span>
          </h4>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <span className="collapsible-section__action shrink-0">{toggleLabel}</span>
      </button>
      {!open && items.length > 0 && (
        <p className="mt-1 text-[11px] text-muted">{items.length} hidden — select to expand</p>
      )}
      <ul className={`bucket-section__items my-work-list my-work-panel--elegant ${open ? "" : "my-work-list--collapsed"}`}>
          {items.length === 0 ? (
            <li className="list-none">
              <EmptyState compact message={emptyText} />
            </li>
          ) : (
            items.map((item, index) => {
              const key = officeItemKey(item, index);
              return (
                <ItemCard
                  key={key}
                  item={item}
                  allItems={allItems}
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
            })
          )}
      </ul>
    </div>
  );
}
