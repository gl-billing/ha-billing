"use client";

import { useCallback, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { formatSheetsAccessHint, type SheetsAccessHint } from "@/lib/sheets-access-help";
import type { TasksHomeData } from "@/lib/office-tasks/home-data";

export function useTasksHomeData(
  email: string,
  clearUnlessProcessing: () => void,
  reportError: (message: string) => void,
  reportWarn: (message: string) => void
) {
  const [data, setData] = useState<TasksHomeData | null>(null);
  const [reloading, setReloading] = useState(false);
  const [lastLoadStatus, setLastLoadStatus] = useState<number | undefined>(undefined);
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  const [sheetsAccessHint, setSheetsAccessHint] = useState<SheetsAccessHint | null>(null);

  const load = useCallback(
    async (q?: string, fresh = false, options?: { keepStatus?: boolean }) => {
      setReloading(true);
      if (!options?.keepStatus) clearUnlessProcessing();
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (fresh) params.set("fresh", "1");
        const query = params.toString();
        const url = query ? `/api/tasks/home?${query}` : "/api/tasks/home";
        const { ok, status: httpStatus, data: json } = await fetchJson<TasksHomeData & { error?: string }>(url, {
          timeoutMs: 90_000
        });
        if (!ok) {
          setLastLoadStatus(httpStatus);
          if (httpStatus === 401) {
            throw new Error("Session expired — sign out and sign in again at /login.");
          }
          if (httpStatus === 429) {
            const quotaMsg =
              json.error || "Google Sheets read limit reached. Wait about 60 seconds, then Update once.";
            setSheetsAccessHint(formatSheetsAccessHint(quotaMsg, email));
            setLastLoadError(quotaMsg);
            reportWarn(quotaMsg);
            setData((prev) => prev ?? null);
            return { data: null, quotaBlocked: true };
          }
          throw new Error(json.error || `Load failed (${httpStatus}).`);
        }
        setData(json);
        setLastLoadStatus(undefined);
        setLastLoadError(null);
        setSheetsAccessHint(null);
        if (!options?.keepStatus) clearUnlessProcessing();
        return { data: json, quotaBlocked: false };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not load data.";
        setSheetsAccessHint(formatSheetsAccessHint(message, email));
        setLastLoadError(message);
        setData(null);
        setLastLoadStatus(undefined);
        reportError(message);
        return { data: null, quotaBlocked: false };
      } finally {
        setReloading(false);
      }
    },
    [clearUnlessProcessing, email, reportError, reportWarn]
  );

  return {
    data,
    setData,
    reloading,
    lastLoadStatus,
    lastLoadError,
    sheetsAccessHint,
    load
  };
}
