"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OFFICE_TIMEZONE } from "@/lib/office-tasks/date-only";
import { readJsonResponse } from "@/lib/fetch-json";
import {
  isPresenceOnline,
  workspaceLabel,
  type StaffPresenceEntry
} from "@/lib/staff-presence";

function formatActivityAt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: OFFICE_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(ms));
}

type RegisterRow = StaffPresenceEntry & { status: "Present" | "Away" };

type Props = {
  onStatus?: (message: string, isError?: boolean) => void;
};

export function StaffPresencePanel({ onStatus }: Props) {
  const [entries, setEntries] = useState<StaffPresenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presence");
      const json = await readJsonResponse<{
        entries?: StaffPresenceEntry[];
        generatedAt?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Unable to load the attendance register.");
      }
      setEntries(Array.isArray(json?.entries) ? json.entries : []);
      setGeneratedAt(json?.generatedAt ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load the attendance register.";
      setError(message);
      onStatus?.(message, true);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const rows = useMemo<RegisterRow[]>(
    () =>
      entries.map((entry) => ({
        ...entry,
        status: isPresenceOnline(entry.lastSeen) ? "Present" : "Away"
      })),
    [entries]
  );

  const presentCount = rows.filter((row) => row.status === "Present").length;

  return (
    <div className="attendance-register">
      <header className="attendance-register__letterhead">
        <p className="attendance-register__eyebrow">Confidential · Firm management</p>
        <div className="attendance-register__title-row">
          <h2 className="attendance-register__title">Staff attendance</h2>
          <button
            type="button"
            className="attendance-register__refresh"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Updating…" : "Update"}
          </button>
        </div>
        <p className="attendance-register__lede">
          Session activity within Hernandez &amp; Associates Office. Shows when a staff account is
          signed in to this system — not a phone or location tracker. Restricted to firm management.
        </p>
      </header>

      {error ? <p className="attendance-register__error">{error}</p> : null}

      {!error && !loading && rows.length === 0 ? (
        <p className="attendance-register__empty">No active or recent sessions recorded.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="attendance-register__table-wrap">
          <table className="attendance-register__table">
            <caption className="attendance-register__caption">
              Present {presentCount} · Recorded {rows.length}
            </caption>
            <thead>
              <tr>
                <th scope="col">Counsel / Staff</th>
                <th scope="col">Status</th>
                <th scope="col">Workspace</th>
                <th scope="col">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email} className={row.status === "Present" ? "is-present" : undefined}>
                  <td className="attendance-register__name">{row.displayName}</td>
                  <td>
                    <span
                      className={
                        row.status === "Present"
                          ? "attendance-register__status attendance-register__status--present"
                          : "attendance-register__status"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>{workspaceLabel(row.workspace)}</td>
                  <td className="attendance-register__time">{formatActivityAt(row.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {generatedAt ? (
        <p className="attendance-register__footer">
          Last refreshed · {formatActivityAt(generatedAt)}
        </p>
      ) : null}
    </div>
  );
}
