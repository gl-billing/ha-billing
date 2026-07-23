"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OFFICE_TIMEZONE } from "@/lib/office-tasks/date-only";
import { readJsonResponse } from "@/lib/fetch-json";
import {
  flattenPresenceLoginLog,
  isPresenceOnline,
  workspaceLabel,
  type StaffPresenceEntry
} from "@/lib/staff-presence";

function formatDateTimeAt(iso: string): string {
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

function formatDateAt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(ms));
}

function formatTimeAt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: OFFICE_TIMEZONE,
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
  const [hint, setHint] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presence");
      const json = await readJsonResponse<{
        entries?: StaffPresenceEntry[];
        generatedAt?: string;
        hint?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Unable to load the attendance register.");
      }
      setEntries(Array.isArray(json?.entries) ? json.entries : []);
      setGeneratedAt(json?.generatedAt ?? null);
      setHint(typeof json?.hint === "string" && json.hint.trim() ? json.hint.trim() : null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load the attendance register.";
      setError(message);
      setHint(null);
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

  const loginLog = useMemo(() => flattenPresenceLoginLog(entries), [entries]);

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
          Who signed in to HA Office, and when. <strong>Last signed in</strong> is the start of their
          current or latest session; the log below lists recent sign-ins by date and time. Present =
          app open now. Restricted to firm management.
        </p>
      </header>

      {error ? <p className="attendance-register__error">{error}</p> : null}
      {hint && !error ? <p className="attendance-register__hint">{hint}</p> : null}

      {!error && !loading && rows.length === 0 ? (
        <p className="attendance-register__empty">No sign-ins recorded yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="attendance-register__table-wrap">
          <table className="attendance-register__table">
            <caption className="attendance-register__caption">
              Present {presentCount} · Staff {rows.length}
            </caption>
            <thead>
              <tr>
                <th scope="col">Counsel / Staff</th>
                <th scope="col">Status</th>
                <th scope="col">Workspace</th>
                <th scope="col">Last signed in</th>
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
                  <td className="attendance-register__time">{formatDateTimeAt(row.lastSignedIn)}</td>
                  <td className="attendance-register__time">{formatDateTimeAt(row.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {loginLog.length > 0 ? (
        <section className="attendance-register__log" aria-labelledby="attendance-login-log-title">
          <h3 id="attendance-login-log-title" className="attendance-register__log-title">
            Sign-in log
          </h3>
          <p className="attendance-register__log-lede">
            Each row is when someone opened HA Office (or returned after being away ~30 minutes).
          </p>
          <div className="attendance-register__table-wrap">
            <table className="attendance-register__table attendance-register__table--log">
              <thead>
                <tr>
                  <th scope="col">Counsel / Staff</th>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {loginLog.map((row) => (
                  <tr key={`${row.email}-${row.at}`}>
                    <td className="attendance-register__name">{row.displayName}</td>
                    <td className="attendance-register__time">{formatDateAt(row.at)}</td>
                    <td className="attendance-register__time">{formatTimeAt(row.at)}</td>
                    <td>{workspaceLabel(row.workspace)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {generatedAt ? (
        <p className="attendance-register__footer">
          Last refreshed · {formatDateTimeAt(generatedAt)}
        </p>
      ) : null}
    </div>
  );
}
