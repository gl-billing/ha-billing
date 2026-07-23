"use client";

import { useCallback, useEffect, useState } from "react";

type CronJobHealthRow = {
  id: string;
  label: string;
  scheduleHint: string;
  configured: boolean;
  status: "ok" | "warn" | "error" | "unknown";
  lastRunAt: string | null;
  lastMessage: string | null;
  lastStatus: "ok" | "error" | null;
};

type CronHealthPayload = {
  overall: "ok" | "warn";
  message: string;
  cronConfigured: boolean;
  tasksScriptConfigured: boolean;
  billingScriptConfigured: boolean;
  googleTokenConfigured: boolean;
  tasksRepair?: {
    source: string;
    at: string;
    counts: Record<string, number>;
    message: string | null;
    error: string | null;
  } | null;
  integrations?: Array<{
    id: string;
    label: string;
    configured: boolean;
    ok: boolean;
    status: "ok" | "warn" | "error";
    message: string;
    scriptUser?: string;
    deployHint?: string;
  }>;
  jobs: CronJobHealthRow[];
};

function formatRunAt(iso: string | null): string {
  if (!iso) return "No run logged yet";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila"
    });
  } catch {
    return iso;
  }
}

/** Desk subset: banner + job dots only (no admin repairs). Full panel stays on Reports. */
export function CronAutomationHealthPanel({
  variant = "full"
}: {
  variant?: "full" | "desk";
}) {
  const desk = variant === "desk";
  const [health, setHealth] = useState<CronHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repairRunning, setRepairRunning] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cron/health");
      const json = (await res.json()) as Partial<CronHealthPayload> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load automation health.");
      if (!Array.isArray(json.jobs)) {
        throw new Error("Could not load automation health.");
      }
      setHealth(json as CronHealthPayload);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Could not load automation health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runRepairsNow() {
    setRepairRunning(true);
    setRepairMessage("");
    try {
      const res = await fetch("/api/cron/task-repairs", { method: "POST" });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not run repairs.");
      setRepairMessage(json.message || "Repairs completed.");
      await load();
    } catch (err) {
      setRepairMessage(err instanceof Error ? err.message : "Could not run repairs.");
    } finally {
      setRepairRunning(false);
    }
  }

  const deskJobs = (health?.jobs ?? []).filter((job) =>
    ["daily-digest", "staff-digest", "retainer-billing", "retainer-digest", "refresh-dashboard"].includes(job.id)
  );

  return (
    <section className={`card cron-automation-health${desk ? " cron-automation-health--desk" : ""}`}>
      <div className="cron-automation-health__head">
        <div>
          <p className="section-label !mb-0">Automation health</p>
          <h3 className="font-display text-lg text-ink">
            {desk ? "Billing automations" : "Scheduled jobs"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {desk
              ? "Digest and retainer billing — green means a recent successful run was logged."
              : "Digests, prep nudges, hearing reminders, sheet repairs, and backups — green means a recent successful run was logged."}
          </p>
        </div>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={loading} onClick={() => void load()}>
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-muted">
          Couldn&apos;t refresh automation health.{" "}
          {!desk ? null : (
            <a href="/billing?page=reports" className="underline">
              Full matrix on Reports
            </a>
          )}
        </p>
      ) : null}

      {health ? (
        <>
          <p
            className={`cron-automation-health__banner cron-automation-health__banner--${health.overall} mt-3 text-sm`}
          >
            {health.message}
          </p>
          {health.billingScriptConfigured && health.cronConfigured ? (
            <p className="mt-2 text-xs text-muted">
              Sheet dashboard refresh can run from both the spreadsheet connection and the nightly schedule —
              that is normal when both are set up.
            </p>
          ) : null}
          {!desk && (health.integrations || []).length ? (
            <ul className="cron-automation-health__list mt-4">
              {(health.integrations || []).map((row) => (
                <li
                  key={row.id}
                  className={`cron-automation-health__row cron-automation-health__row--${row.status}`}
                >
                  <span className="cron-automation-health__dot" aria-hidden />
                  <div className="cron-automation-health__copy">
                    <span className="cron-automation-health__label">{row.label}</span>
                    <span className="cron-automation-health__meta">
                      {row.configured ? (row.ok ? "Connected" : "Needs attention") : "Not configured"}
                      {row.scriptUser ? ` · ${row.scriptUser}` : ""}
                    </span>
                    <span className="cron-automation-health__run">{row.message}</span>
                    {row.deployHint && row.status !== "ok" ? (
                      <span className="cron-automation-health__error">{row.deployHint}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {!desk && health.tasksRepair ? (
            <div className="cron-automation-health__repair mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="font-medium text-ink">Sheet task repairs (Today / cron)</p>
              <p className="mt-1 text-muted">
                Last run ({health.tasksRepair.source}): {formatRunAt(health.tasksRepair.at)}
              </p>
              {health.tasksRepair.message ? (
                <p className="mt-1 text-ink">{health.tasksRepair.message}</p>
              ) : (
                <p className="mt-1 text-muted">No sheet changes on last run.</p>
              )}
              {health.tasksRepair.error ? (
                <p className="mt-1 text-red-800">{health.tasksRepair.error}</p>
              ) : null}
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1.5 text-xs"
                disabled={repairRunning}
                onClick={() => void runRepairsNow()}
              >
                {repairRunning ? "Running repairs…" : "Run repairs now (admin)"}
              </button>
              {repairMessage ? <p className="mt-2 text-muted">{repairMessage}</p> : null}
            </div>
          ) : null}
          <ul className="cron-automation-health__list mt-4">
            {(desk ? deskJobs : health.jobs ?? []).map((job) => (
              <li key={job.id} className={`cron-automation-health__row cron-automation-health__row--${job.status}`}>
                <span className="cron-automation-health__dot" aria-hidden />
                <div className="cron-automation-health__copy">
                  <span className="cron-automation-health__label">{job.label}</span>
                  <span className="cron-automation-health__meta">
                    {job.scheduleHint}
                    {!job.configured ? " · not fully configured" : ""}
                  </span>
                  <span className="cron-automation-health__run">
                    {formatRunAt(job.lastRunAt)}
                    {job.lastStatus === "error" ? " · last run failed" : job.lastStatus === "ok" ? " · OK" : ""}
                  </span>
                  {job.lastMessage && job.status === "error" ? (
                    <span className="cron-automation-health__error">{job.lastMessage}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
