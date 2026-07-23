"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArAgingReport, MonthlyCollectionsReport } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { MetricSkeleton, Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { SmartLoadEmptyState } from "@/components/SmartLoadEmptyState";
import { HealthChecksPanel } from "@/components/HealthChecksPanel";
import { CronAutomationHealthPanel } from "@/components/CronAutomationHealthPanel";
import { FirmAutomationSettingsPanel } from "@/components/FirmAutomationSettingsPanel";
import { RetainerOpsToolsPanel } from "@/components/RetainerOpsToolsPanel";
import { TrustLedgerPanel } from "@/components/TrustLedgerPanel";
import { IntegrationsSetupChecklist } from "@/components/IntegrationsSetupChecklist";
import { useFirmAdmin } from "@/hooks/useFirmAdmin";
import type { PartnerWeeklyReport } from "@/lib/sheets/partner-weekly";

type Props = {
  busy: boolean;
  onStatus: (message: string, isError?: boolean) => void;
  onBusy?: (busy: boolean) => void;
};

type ScriptStatus = {
  ok: boolean;
  configured: boolean;
  error?: string;
  scriptUser?: string;
};

export function ReportsPanel({ busy, onStatus, onBusy }: Props) {
  const isAdmin = useFirmAdmin();
  const [aging, setAging] = useState<ArAgingReport | null>(null);
  const [collections, setCollections] = useState<MonthlyCollectionsReport | null>(null);
  const [agingLoading, setAgingLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [agingError, setAgingError] = useState("");
  const [collectionsError, setCollectionsError] = useState("");
  const [section, setSection] = useState<"aging" | "collections" | "trust">("aging");
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [backupPdfBusy, setBackupPdfBusy] = useState(false);
  const [lastPdfBackupAt, setLastPdfBackupAt] = useState<string | null>(null);
  const [backupStatusLoading, setBackupStatusLoading] = useState(false);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | null>(null);
  const [scriptStatusLoading, setScriptStatusLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [partnerReport, setPartnerReport] = useState<PartnerWeeklyReport | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState(false);

  const loadAging = useCallback(async () => {
    setAgingLoading(true);
    setAgingError("");
    try {
      const res = await fetch("/api/reports/aging");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load aging report.");
      setAging(json as ArAgingReport);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to load aging report.";
      setAgingError(msg);
      setAging(null);
    } finally {
      setAgingLoading(false);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    setCollectionsError("");
    try {
      const res = await fetch(`/api/reports/collections?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load collections report.");
      setCollections(json as MonthlyCollectionsReport);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to load collections report.";
      setCollectionsError(msg);
      setCollections(null);
    } finally {
      setCollectionsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadAging();
  }, [loadAging]);

  const loadScriptStatus = useCallback(async () => {
    setScriptStatusLoading(true);
    try {
      const res = await fetch("/api/documents/status");
      const json = (await res.json()) as ScriptStatus;
      setScriptStatus(json);
    } catch {
      setScriptStatus({ ok: false, configured: false, error: "Could not check Apps Script connection." });
    } finally {
      setScriptStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScriptStatus();
  }, [loadScriptStatus]);

  const loadBackupStatus = useCallback(async () => {
    if (!isAdmin) return;
    setBackupStatusLoading(true);
    try {
      const res = await fetch("/api/export/backup-status");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load backup status.");
      setLastPdfBackupAt(json.lastBackupAt ?? null);
    } catch {
      setLastPdfBackupAt(null);
    } finally {
      setBackupStatusLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadBackupStatus();
  }, [isAdmin, loadBackupStatus]);

  useEffect(() => {
    if (section === "collections") {
      void loadCollections();
    }
  }, [section, year, month, loadCollections]);

  async function runMaintenance(action: string, label: string) {
    setMaintenanceBusy(true);
    onBusy?.(true);
    onStatus(`${label}...`);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      onStatus(json.message || `${label} completed.`);
      await loadScriptStatus();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Action failed.", true);
    } finally {
      setMaintenanceBusy(false);
      onBusy?.(false);
    }
  }

  async function downloadBackupPdf() {
    setBackupPdfBusy(true);
    onBusy?.(true);
    onStatus("Preparing incremental backup PDF…");
    try {
      const res = await fetch("/api/export/backup-pdf");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Backup download failed.");
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ha-billing-backup-${stamp}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onStatus("Backup PDF downloaded. Next backup will include only new activity.");
      await loadBackupStatus();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Backup download failed.", true);
    } finally {
      setBackupPdfBusy(false);
      onBusy?.(false);
    }
  }

  const maintenanceDisabled = busy || maintenanceBusy || backupPdfBusy;

  if (agingLoading && !aging) {
    return (
      <div className="space-y-3">
        <MetricSkeleton />
        <Skeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="reports-panel space-y-3">
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="section-label !mb-0">Reports &amp; exports</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="/api/export/clients" className="btn-secondary text-xs">
              Export clients CSV
            </a>
            <a href="/api/export/aging" className="btn-secondary text-xs">
              Export aging CSV
            </a>
          </div>
        </div>

        <div className="nav-tabs !mb-2 grid-cols-3">
          {(
            [
              ["aging", "AR aging"],
              ["collections", "Collections"],
              ["trust", "Trust"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav-tab ${section === id ? "nav-tab-active" : "nav-tab-idle"}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {section === "aging" && (
          <>
            {agingError ? (
              <SmartLoadEmptyState
                errorMessage={agingError}
                context="billing"
                onRetry={() => void loadAging()}
              />
            ) : aging ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Total outstanding:{" "}
                  <strong className="reports-panel__accent">{formatPeso(aging.totalOutstanding)}</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["current", "0–30 days"],
                      ["31-60", "31–60 days"],
                      ["61-90", "61–90 days"],
                      ["90+", "90+ days"]
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="reports-panel__metric p-2 text-center">
                    <p className="section-label !mb-1 !text-[0.68rem]">{label}</p>
                      <p className="mt-1 text-sm font-extrabold text-ink">
                        {aging.buckets[key].length}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatPeso(aging.buckets[key].reduce((s, e) => s + e.balance, 0))}
                      </p>
                    </div>
                  ))}
                </div>

                {(["90+", "61-90", "31-60"] as const).map((bucket) => {
                  const items = aging.buckets[bucket];
                  if (!items.length) return null;
                  return (
                    <div key={bucket}>
                      <p className="mb-1 text-xs font-bold text-[#8b1e1e]">{bucket} days overdue</p>
                      <div className="space-y-1">
                        {items.slice(0, 8).map((e) => (
                          <div
                            key={e.code}
                            className="flex flex-col gap-1 rounded border border-line/60 bg-[#faf9f7] px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="min-w-0 break-words">
                              <strong>{e.code}</strong> · {e.name}
                            </span>
                            <span className="shrink-0 font-bold text-[#8b1e1e] sm:text-right">
                              {formatPeso(e.balance)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}

        {section === "collections" && (
          <div className="space-y-3">
            <p className="text-[10px] text-muted">
              Loaded on demand to avoid Google Sheets rate limits. First load may take a few seconds.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="field !w-auto text-xs"
                value={month}
                disabled={busy || collectionsLoading}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                className="field !w-auto text-xs"
                value={year}
                disabled={busy || collectionsLoading}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-gold text-xs"
                disabled={busy || collectionsLoading}
                onClick={() => void loadCollections()}
              >
                {collectionsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {collectionsError ? (
              <SmartLoadEmptyState
                errorMessage={collectionsError}
                context="billing"
                onRetry={() => void loadCollections()}
              />
            ) : collectionsLoading && !collections ? (
              <Skeleton lines={3} />
            ) : collections ? (
              <>
                <p className="text-sm font-bold text-ink">{collections.monthLabel}</p>
                <div className="grid grid-cols-1 gap-2 text-center text-xs min-[420px]:grid-cols-3">
                  <div className="reports-panel__metric p-2">
                    <p className="section-label !mb-1 !text-[0.68rem]">Charges</p>
                    <p className="mt-1 font-extrabold">{formatPeso(collections.totalCharges)}</p>
                  </div>
                  <div className="reports-panel__metric p-2">
                    <p className="section-label !mb-1 !text-[0.68rem]">Payments</p>
                    <p className="mt-1 font-extrabold">
                      {formatPeso(collections.totalPayments)}
                    </p>
                  </div>
                  <div className="reports-panel__metric p-2">
                    <p className="section-label !mb-1 !text-[0.68rem]">Net</p>
                    <p className="mt-1 font-extrabold">{formatPeso(collections.netCollected)}</p>
                  </div>
                </div>
                {collections.byClient.length ? (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {collections.byClient.map((c) => (
                      <div
                        key={c.code}
                        className="flex flex-col gap-1 rounded border border-line/60 px-2 py-1 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="min-w-0 break-words">
                          {c.code} · {c.name}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums sm:text-right">
                          +{formatPeso(c.charges)} / −{formatPeso(c.payments)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState compact message="No ledger activity for this month." />
                )}
              </>
            ) : null}
          </div>
        )}

        {section === "trust" && <TrustLedgerPanel busy={busy} onNotify={onStatus} />}
      </section>

      <section className="card partner-weekly-report">
        <div className="partner-weekly-report__head">
          <p className="section-label partner-weekly-report__title">Weekly partner report</p>
          <p className="partner-weekly-report__desc">
            Summary for partners: overdue AR, collections, team workload, hearings, and court confirmations.
            Cron runs Mondays at 6:00 AM when configured.
          </p>
        </div>
        <div className="partner-weekly-report__actions">
          <button
            type="button"
            className="partner-weekly-report__btn partner-weekly-report__btn--secondary"
            disabled={partnerLoading || busy}
            onClick={() => {
              setPartnerLoading(true);
              void fetch("/api/reports/partner-weekly")
                .then(async (res) => {
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "Unable to load report.");
                  setPartnerReport(json.report);
                  onStatus("Weekly report loaded.");
                })
                .catch((e) => onStatus(e instanceof Error ? e.message : "Failed.", true))
                .finally(() => setPartnerLoading(false));
            }}
          >
            {partnerLoading ? "Loading…" : "Preview report"}
          </button>
          <button
            type="button"
            className="partner-weekly-report__btn partner-weekly-report__btn--gold"
            disabled={partnerBusy || busy}
            onClick={() => {
              setPartnerBusy(true);
              void fetch("/api/reports/partner-weekly", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                .then(async (res) => {
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "Failed to send.");
                  setPartnerReport(json.report || null);
                  onStatus(json.message || "Report sent.");
                })
                .catch((e) => onStatus(e instanceof Error ? e.message : "Failed.", true))
                .finally(() => setPartnerBusy(false));
            }}
          >
            {partnerBusy ? "Sending…" : "Email partners now"}
          </button>
        </div>
        {partnerReport ? (
          <div className="partner-weekly-report__preview">
            <div className="partner-weekly-report__preview-head">
              <p className="partner-weekly-report__week-label">Report period</p>
              <p className="partner-weekly-report__week-value">{partnerReport.weekLabel}</p>
            </div>

            <div className="partner-weekly-report__section">
              <p className="partner-weekly-report__section-title">Billing</p>
              <div className="partner-weekly-report__stat-grid">
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">Overdue clients</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.billing.overdueClients}</p>
                </div>
                <div className="partner-weekly-report__stat-box partner-weekly-report__stat-box--warn">
                  <p className="partner-weekly-report__stat-label">Total overdue balance</p>
                  <p className="partner-weekly-report__stat-value">{formatPeso(partnerReport.billing.totalOverdueBalance)}</p>
                </div>
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">Collections this week</p>
                  <p className="partner-weekly-report__stat-value partner-weekly-report__stat-value--positive">
                    {formatPeso(partnerReport.billing.collectionsThisWeek)}
                  </p>
                </div>
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">New clients this week</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.billing.newClientsThisWeek}</p>
                </div>
              </div>
            </div>

            <div className="partner-weekly-report__section">
              <p className="partner-weekly-report__section-title">Tasks &amp; hearings</p>
              <div className="partner-weekly-report__stat-grid partner-weekly-report__stat-grid--tasks">
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">Open overdue tasks</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.tasks.overdueOpen}</p>
                </div>
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">Completed this week</p>
                  <p className="partner-weekly-report__stat-value partner-weekly-report__stat-value--positive">
                    {partnerReport.tasks.completedThisWeek}
                  </p>
                </div>
                <div className="partner-weekly-report__stat-box">
                  <p className="partner-weekly-report__stat-label">Hearings this week</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.tasks.hearingsThisWeek}</p>
                </div>
                <div className="partner-weekly-report__stat-box partner-weekly-report__stat-box--warn">
                  <p className="partner-weekly-report__stat-label">Due within 48h</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.tasks.escalationDue}</p>
                </div>
                <div className="partner-weekly-report__stat-box partner-weekly-report__stat-box--info">
                  <p className="partner-weekly-report__stat-label">Court confirm pending</p>
                  <p className="partner-weekly-report__stat-value">{partnerReport.tasks.courtConfirmationPending}</p>
                </div>
              </div>
            </div>

            {partnerReport.employees.length ? (
              <div className="partner-weekly-report__section">
                <p className="partner-weekly-report__section-title">Team workload</p>
                <div className="partner-weekly-report__table-wrap">
                  <table className="partner-weekly-report__table firm-ledger-table firm-ledger-table--responsive-stack">
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Open</th>
                        <th>Overdue</th>
                        <th>Done this week</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerReport.employees.map((employee) => (
                        <tr key={employee.name}>
                          <td data-label="Staff">{employee.name}</td>
                          <td data-label="Open">{employee.openTasks}</td>
                          <td data-label="Overdue">{employee.overdueTasks}</td>
                          <td data-label="Done this week">{employee.completedThisWeek}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <HealthChecksPanel busy={busy} onStatus={onStatus} />

      <CronAutomationHealthPanel />

      <FirmAutomationSettingsPanel />

      <RetainerOpsToolsPanel />

      <section className="card">
        <p className="section-label !mb-0">Integrations</p>
        <h3 className="font-display text-lg text-ink">Setup checklist</h3>
        <p className="mt-1 mb-3 text-sm text-muted">
          Google sign-in, Sheets workbooks, and document storage for this firm.
        </p>
        <IntegrationsSetupChecklist />
      </section>

      <section className="card">
        <p className="section-label">Maintenance</p>

        {scriptStatusLoading ? (
          <p className="mb-3 text-sm text-muted">Checking Apps Script connection…</p>
        ) : scriptStatus?.ok ? (
          <p className="reports-maintenance-banner reports-maintenance-banner--ok">
            Apps Script connected
            {scriptStatus.scriptUser ? ` as ${scriptStatus.scriptUser}` : ""}. SOA, overview refresh, and
            hourly update can run from here. On Vercel, firm overview also refreshes hourly via cron when{" "}
            <code>CRON_SECRET</code> is set.
          </p>
        ) : (
          <div className="reports-maintenance-banner reports-maintenance-banner--warn">
            <p className="font-bold text-ink">Apps Script not ready</p>
            <p className="mt-1 text-muted">{scriptStatus?.error || "Connection check failed."}</p>
            {isAdmin ? (
              <p className="mt-2 text-sm leading-snug text-muted">
                <strong className="text-ink">Download backup PDF</strong> still works — it reads directly from the billing spreadsheet and
                does not need Apps Script. The other maintenance buttons below require a working Web App connection.
              </p>
            ) : null}
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => void loadScriptStatus()}
            >
              Retry connection check
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            disabled={maintenanceDisabled || !scriptStatus?.ok}
            className="btn-secondary whitespace-normal text-xs leading-snug"
            onClick={() => void runMaintenance("setupAutoRefreshTrigger", "Installing hourly update")}
          >
            {maintenanceBusy ? "Working…" : "Enable hourly overview sync"}
          </button>
          <button
            type="button"
            disabled={maintenanceDisabled || !scriptStatus?.ok}
            className="btn-secondary whitespace-normal text-xs leading-snug"
            onClick={() => void runMaintenance("backupSpreadsheet", "Creating backup")}
          >
            Backup spreadsheet
          </button>
          {isAdmin ? (
            <button
              type="button"
              disabled={maintenanceDisabled}
              className="btn-secondary whitespace-normal text-xs leading-snug"
              onClick={() => void downloadBackupPdf()}
            >
              {backupPdfBusy ? "Preparing PDF…" : "Download backup PDF"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={maintenanceDisabled || !scriptStatus?.ok}
            className="btn-secondary whitespace-normal text-xs leading-snug"
            onClick={() => void runMaintenance("refreshDashboard", "Updating overview")}
          >
            Update overview now
          </button>
        </div>
        {isAdmin ? (
          <p className="reports-maintenance-hint">
            {backupStatusLoading
              ? "Checking last PDF backup…"
              : lastPdfBackupAt
                ? `Last PDF backup: ${new Date(lastPdfBackupAt).toLocaleString()}. Each download includes audit and document activity since that time only — no duplicate entries.`
                : "No PDF backup yet. The first download includes all audit and document log activity; later downloads include only new entries since the previous backup."}
          </p>
        ) : null}
        <p className="reports-maintenance-hint">
          Hourly sync installs a trigger in your billing spreadsheet (Extensions → Apps Script → paste{" "}
          <strong>Triggers.gs</strong>, deploy Web App). If the button fails, run{" "}
          <strong>installHourlyDashboardRefresh()</strong> once in the script editor. Production also
          refreshes hourly via Vercel cron when configured.
        </p>
      </section>
    </div>
  );
}
