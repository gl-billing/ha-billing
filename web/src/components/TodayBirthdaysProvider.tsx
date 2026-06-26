"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { TodayBirthdaySummary } from "@/lib/sheets/birthday-greetings";

export const BIRTHDAYS_REFRESH_EVENT = "gl-birthdays-refresh";

type TodayBirthdaysContextValue = {
  clients: TodayBirthdaySummary[];
  pendingClients: TodayBirthdaySummary[];
  todayCodes: Set<string>;
  refresh: () => void;
};

const TodayBirthdaysContext = createContext<TodayBirthdaysContextValue | null>(null);

type ProviderProps = {
  billingAccess?: boolean;
  children: ReactNode;
};

export function TodayBirthdaysProvider({ billingAccess = true, children }: ProviderProps) {
  const [clients, setClients] = useState<TodayBirthdaySummary[]>([]);

  const refresh = useCallback(async () => {
    if (!billingAccess) {
      setClients([]);
      return;
    }
    try {
      const response = await fetch("/api/birthdays/today");
      if (!response.ok) return;
      const data = await response.json();
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch {
      /* optional */
    }
  }, [billingAccess]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!billingAccess) return;

    function onRefresh() {
      void refresh();
    }

    function onFocus() {
      void refresh();
    }

    window.addEventListener(BIRTHDAYS_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(BIRTHDAYS_REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [billingAccess, refresh]);

  const value = useMemo<TodayBirthdaysContextValue>(
    () => ({
      clients,
      pendingClients: clients.filter((client) => !client.greetingSentThisYear),
      todayCodes: new Set(clients.map((client) => client.code)),
      refresh
    }),
    [clients, refresh]
  );

  return <TodayBirthdaysContext.Provider value={value}>{children}</TodayBirthdaysContext.Provider>;
}

export function useTodayBirthdays(): TodayBirthdaysContextValue {
  const context = useContext(TodayBirthdaysContext);
  return (
    context ?? {
      clients: [],
      pendingClients: [],
      todayCodes: new Set<string>(),
      refresh: () => {}
    }
  );
}

export function notifyBirthdaysRefresh(): void {
  window.dispatchEvent(new Event(BIRTHDAYS_REFRESH_EVENT));
}
