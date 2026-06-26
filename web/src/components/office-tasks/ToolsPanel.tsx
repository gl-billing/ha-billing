"use client";

import { useState } from "react";
import { TaxDeadlinesPanel } from "@/components/office-tasks/TaxDeadlinesPanel";
import { StaffRemindersPanel } from "@/components/office-tasks/StaffRemindersPanel";
import { HearingRemindersPanel } from "@/components/office-tasks/HearingRemindersPanel";
import { HealthChecksPanel } from "@/components/HealthChecksPanel";
import { EventsDiagnosticsResults } from "@/components/office-tasks/EventsDiagnosticsPanel";
import { OrphanTasksPanel } from "@/components/office-tasks/OrphanTasksPanel";
import { ViewHero } from "@/components/office-tasks/PremiumUI";
import { CronDigestStatus } from "@/components/CronDigestStatus";
import { CalendarSyncStatus } from "@/components/CalendarSyncStatus";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  fetchEventsDiagnostics,
  formatEventsDiagnosticsSummary,
  type EventsDiagnostics
} from "@/lib/office-tasks/events-diagnostics";

type Props = {
  busy: boolean;
  isAdmin: boolean;
    spreadsheetId?: string;
  tasksAppsScriptConfigured?: boolean;
  employees: string[];
  items: OfficeItem[];
  today: string;
  weekDates: string[];
  employeeDirectory: EmployeeRecord[];
  onAction: (action: string) => void;
  onPrintToday: () => void;
  onReload: () => void;
  onStatus: (msg: string) => void;
};

export function ToolsPanel({
  busy,
  isAdmin,
    spreadsheetId,
  tasksAppsScriptConfigured = false,
  employees,
  items,
  today,
  weekDates,
  employeeDirectory,
  onAction,
  onPrintToday,
  onReload,
  onStatus
}: Props) {
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<EventsDiagnostics | null>(null);

  const sheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null;

  async function runEventsCheck() {
    setDiagLoading(true);
    try {
      const json = await fetchEventsDiagnostics();
      setDiagData(json);
      onStatus(formatEventsDiagnosticsSummary(json));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Events sheet check failed.";
      setDiagData({ error: message });
      onStatus(message);
    } finally {
      setDiagLoading(false);
    }
  }

  return (
    <div className="tools-panel">
      <ViewHero
        eyebrow="Office tools"
        title="Maintenance & exports"
        subtitle="Refresh sheet views, sync calendar, print lists, and manage BIR tax deadlines."
      />

      <section className="card tools-panel__section">
        <h2 className="section-label">Sheet &amp; calendar</h2>
        <CalendarSyncStatus items={items} className="mb-3" />
        <p className="mb-3 text-sm text-muted">
          Events live in the <strong>Office Tasks</strong> spreadsheet (Hearings &amp; Events tab), not in Billing.
          <strong>+ Event</strong>, <strong>My work</strong>, and <strong>Check events sheet</strong> work without Apps
          Script. Calendar sync and legacy reminders are optional and stay disabled until{" "}
          <code className="text-ink">TASKS_APPS_SCRIPT_*</code> is set.
        </p>
        <div className="tools-btn-grid">
          <ToolButton
            label="Check events sheet"
            sub="Rows, parsing & today"
            disabled={busy || diagLoading}
            onClick={() => void runEventsCheck()}
            variant="primary"
          />
          <ToolButton
            label="Pull up distant rows"
            sub="Move real tasks/events below your main list (column A)"
            disabled={busy}
            onClick={() => onAction("consolidateSheetRows")}
            variant="primary"
          />
          <ToolButton
            label="Refresh overviews"
            disabled={busy || !tasksAppsScriptConfigured}
            onClick={() => onAction("refreshAllOverviews")}
          />
          <ToolButton
            label="Sync all open → Calendar"
            disabled={busy || !tasksAppsScriptConfigured}
            onClick={() => onAction("syncAllOpenCalendar")}
          />
          <ToolButton
            label="Sync upcoming → Calendar"
            disabled={busy || !tasksAppsScriptConfigured}
            onClick={() => onAction("syncUpcomingCalendar")}
          />
          <ToolButton
            label="Pull Calendar → Sheet"
            disabled={busy}
            onClick={() => onAction("pullCalendarFromGoogle")}
          />
          {isAdmin && (
            <ToolButton
              label="Legacy reminder run"
              sub={tasksAppsScriptConfigured ? "Original Apps Script job" : undefined}
              disabled={busy || !tasksAppsScriptConfigured}
              onClick={() => onAction("sendRemindersNow")}
              variant="accent"
            />
          )}
        </div>
        {sheetUrl  ? (
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="tool-sheet-link">
            Open Office Tasks spreadsheet →
          </a>
        ) : null}
        <EventsDiagnosticsResults data={diagData}  />
      </section>

      {isAdmin ? <CronDigestStatus /> : null}

      {isAdmin && (
        <StaffRemindersPanel
          layout="full"
          items={items}
          today={today}
          weekDates={weekDates}
          directory={employeeDirectory}
          isAdmin={isAdmin}
          busy={busy}
          onStatus={onStatus}
        />
      )}

      {isAdmin && (
        <HearingRemindersPanel
          items={items}
          today={today}
          busy={busy}
          isAdmin={isAdmin}
          directory={employeeDirectory}
          onStatus={(msg, isError) => onStatus(isError ? `⚠ ${msg}` : msg)}
        />
      )}

      {isAdmin ? <HealthChecksPanel busy={busy} onStatus={(msg, isError) => onStatus(isError ? `⚠ ${msg}` : msg)} /> : null}

      {isAdmin ? (
        <OrphanTasksPanel busy={busy} onStatus={(msg, isError) => onStatus(isError ? `⚠ ${msg}` : msg)} />
      ) : null}

      <section className="card tools-panel__section">
        <h2 className="section-label">Print &amp; export</h2>
        <div className="tools-btn-grid">
          <ToolButton
            label="Print priority today list"
            disabled={busy}
            onClick={onPrintToday}
            variant="primary"
          />
          <ToolButton label="Reload data" disabled={busy} onClick={onReload} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Opens the <strong>Today</strong> tab and prints the prioritized list (overdue first). Use{" "}
          <strong>Calendar</strong> and <strong>Week</strong> for monthly and weekly print layouts.
        </p>
      </section>

      <TaxDeadlinesPanel employees={employees} busy={busy} isAdmin={isAdmin} onAdded={onReload} onStatus={onStatus} />
    </div>
  );
}

function ToolButton({
  label,
  sub,
  disabled,
  onClick,
  variant = "default"
}: {
  label: string;
  sub?: string;
  disabled: boolean;
  onClick: () => void;
  variant?: "default" | "primary" | "accent";
}) {
  const variantClass =
    variant === "primary" ? "tool-action-btn--primary" : variant === "accent" ? "tool-action-btn--accent" : "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`tool-action-btn ${variantClass}`}
    >
      <span className="tool-action-btn__label">{label}</span>
      {sub ? <span className="tool-action-btn__sub">{sub}</span> : null}
    </button>
  );
}
