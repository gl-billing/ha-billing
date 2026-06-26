import { fetchJson } from "@/lib/fetch-json";

export type EventsDiagnostics = {
  today?: string;
    spreadsheetId?: string;
  sheetUrl?: string;
  hasEventsTab?: boolean;
  rawEventRowCount?: number;
  parsedEventCount?: number;
  gdciEvents?: Array<{ id: string; clientCase: string; date: string | null; category: string }>;
  hakolaEvents?: Array<{ id: string; clientCase: string; date: string | null; category: string }>;
  eventsToday?: Array<{ id: string; clientCase: string; date: string | null }>;
  eventsMissingDate?: Array<{ id: string; clientCase: string; rowNumber: number }>;
  matchingRawRows?: Array<Record<string, string>>;
  lastRawRows?: Array<Record<string, string>>;
  error?: string;
};

export function formatEventsDiagnosticsSummary(data: EventsDiagnostics): string {
  if (data.error) return data.error;
  const parsed = data.parsedEventCount ?? 0;
  const raw = data.rawEventRowCount ?? 0;
  const skipped = Math.max(0, raw - parsed);
  const parts = [
    `${parsed} event(s) recognized by the app`,
    `${raw} row(s) on the Hearings & Events tab`,
    `${data.eventsToday?.length ?? 0} dated today`,
    `GDCI: ${data.gdciEvents?.length ?? 0}`,
    `Hakola: ${data.hakolaEvents?.length ?? 0}`
  ];
  if (skipped > 50) {
    parts.push(
      `${skipped} sheet rows skipped (blank or missing client, details, and dates — normal on older sheets)`
    );
  }
  return `${parts.join(" · ")}.`;
}

export async function fetchEventsDiagnostics(): Promise<EventsDiagnostics> {
  const { ok, data } = await fetchJson<EventsDiagnostics>("/api/tasks/diagnostics", { timeoutMs: 90_000 });
  if (!ok) throw new Error(data.error || "Events sheet check failed.");
  return data;
}
