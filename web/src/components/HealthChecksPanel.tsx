"use client";

import { useCallback, useState } from "react";
import type { HealthCheck } from "@/lib/health-checks";

type Props = {
  busy?: boolean;
  onStatus: (message: string, isError?: boolean) => void;
};

export function HealthChecksPanel({ busy, onStatus }: Props) {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Health check failed.");
      setChecks(json.checks || []);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Health check failed.", true);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  async function repairSourceIds() {
    setRepairBusy(true);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repair-source-ids" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Repair failed.");
      onStatus(json.message || "Repair complete.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Repair failed.", true);
    } finally {
      setRepairBusy(false);
    }
  }

  return (
    <section className="card tools-panel__section health-checks-panel">
      <div className="health-checks-panel__header">
        <h2 className="section-label health-checks-panel__title">Data health checks</h2>
        <button
          type="button"
          className="health-checks-panel__refresh btn-secondary"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-xs text-muted">Running checks…</p> : null}

      {!loading && checks.length === 0 ? (
        <p className="text-xs text-muted">Click Refresh to run data health checks (uses Google Sheets reads).</p>
      ) : null}

      <ul className="space-y-2">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`health-checks-panel__item ${
              check.status === "ok"
                ? "health-checks-panel__item--ok"
                : check.status === "warn"
                  ? "health-checks-panel__item--warn"
                  : "health-checks-panel__item--error"
            }`}
          >
            <p className="health-checks-panel__item-title">
              {check.label}
              {check.count ? ` (${check.count})` : ""}
            </p>
            <p className="health-checks-panel__item-message">{check.message}</p>
          </li>
        ))}
      </ul>

      {checks.some((c) => c.id === "invalid-source-ids" && c.count > 0) ? (
        <button
          type="button"
          className="btn-gold mt-3 text-xs"
          disabled={repairBusy || busy}
          onClick={() => void repairSourceIds()}
        >
          Repair invalid task / event IDs
        </button>
      ) : null}
    </section>
  );
}
