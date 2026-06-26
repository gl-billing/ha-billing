"use client";

import { useState } from "react";
import {
  fetchEventsDiagnostics,
  formatEventsDiagnosticsSummary,
  type EventsDiagnostics
} from "@/lib/office-tasks/events-diagnostics";

type Props = {
  onStatus: (msg: string) => void;
  /** When true, only render the results block (button lives elsewhere). */
  resultsOnly?: boolean;
  data?: EventsDiagnostics | null;
};

export function EventsDiagnosticsResults({
  data,
  }: {
  data: EventsDiagnostics | null;
  }) {
  if (!data) return null;

  if (data.error) {
    return <p className="mt-3 text-sm text-red-700">{data.error}</p>;
  }

  
  return (
    <div className="mt-4 rounded-lg border border-amber-200/60 bg-amber-50/40 p-4">
      {data.sheetUrl ? (
        <p className="text-sm">
          <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="font-bold text-gold underline">
            Open Office Tasks spreadsheet
          </a>
        </p>
      ) : null}
      <ul className="mt-3 space-y-1 text-sm text-ink">
        <li>
          Today: <strong>{data.today}</strong>
        </li>
        <li>
          Hearings &amp; Events tab: <strong>{data.hasEventsTab ? "found" : "missing"}</strong>
        </li>
        <li>
          Rows on sheet: <strong>{data.rawEventRowCount}</strong> · Recognized by app:{" "}
          <strong>{data.parsedEventCount}</strong>
          {(data.rawEventRowCount ?? 0) - (data.parsedEventCount ?? 0) > 50 ? (
            <span className="text-muted">
              {" "}
              (many rows skipped — blank or missing client, details, and dates)
            </span>
          ) : null}
        </li>
        <li>
          Events dated today: <strong>{data.eventsToday?.length ?? 0}</strong>
        </li>
        <li>
          GDCI events: <strong>{data.gdciEvents?.length ?? 0}</strong>
        </li>
        <li>
          Hakola events: <strong>{data.hakolaEvents?.length ?? 0}</strong>
        </li>
      </ul>
      {data.matchingRawRows?.length ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-cream/80 p-2 text-xs text-ink">
          {JSON.stringify(data.matchingRawRows, null, 2)}
        </pre>
      ) : (data.rawEventRowCount ?? 0) > 0 ? (
        <p className="mt-3 text-sm text-amber-900">
          No GDCI/Hakola on the sheet — the event save likely never finished. Use <strong>+ Event</strong> again and
          look for &quot;Hearing/event added&quot;.
        </p>
      ) : (
        <p className="mt-3 text-sm text-amber-900">
          The Hearings &amp; Events tab is empty — no events have been saved to the Office Tasks spreadsheet yet.
        </p>
      )}
    </div>
  );
}

export function EventsDiagnosticsPanel({ onStatus, resultsOnly, data: externalData }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EventsDiagnostics | null>(externalData ?? null);

  async function runCheck() {
    setLoading(true);
    try {
      const json = await fetchEventsDiagnostics();
      setData(json);
      onStatus(formatEventsDiagnosticsSummary(json));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setData({ error: message });
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  if (resultsOnly) {
    return <EventsDiagnosticsResults data={data} />;
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" disabled={loading} onClick={() => void runCheck()}>
        {loading ? "Checking…" : "Check events sheet"}
      </button>
      <EventsDiagnosticsResults data={data} />
    </>
  );
}

export function useEventsDiagnosticsCheck(onStatus: (msg: string) => void) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EventsDiagnostics | null>(null);

  async function runCheck() {
    setLoading(true);
    try {
      const json = await fetchEventsDiagnostics();
      setData(json);
      onStatus(formatEventsDiagnosticsSummary(json));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setData({ error: message });
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return { loading, data, runCheck };
}
