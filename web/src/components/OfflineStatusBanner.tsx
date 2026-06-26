"use client";

import { useCallback, useEffect, useState } from "react";
import { countOfflineWrites, flushOfflineWriteQueue } from "@/lib/offline-write-queue";

type Props = {
  onStatus?: (message: string, isError?: boolean) => void;
};

export function OfflineStatusBanner({ onStatus }: Props) {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setPending(countOfflineWrites());
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, []);

  useEffect(() => {
    refresh();
    const onOnline = () => {
      refresh();
      void flushOfflineWriteQueue().then((result) => {
        refresh();
        if (result.synced > 0) {
          onStatus?.(`Synced ${result.synced} queued change${result.synced === 1 ? "" : "s"}.`);
        }
      });
    };
    const onOffline = () => refresh();
    const onStorage = () => refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(refresh, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [onStatus, refresh]);

  if (online && pending === 0) return null;

  async function syncNow() {
    setSyncing(true);
    try {
      const result = await flushOfflineWriteQueue();
      refresh();
      if (result.synced > 0) {
        onStatus?.(`Synced ${result.synced} queued change${result.synced === 1 ? "" : "s"}.`);
      } else if (result.remaining > 0) {
        onStatus?.("Still offline or server unreachable — try again when connected.", true);
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="offline-status-banner no-print" role="status">
      <p className="offline-status-banner__text">
        {!online
          ? "You are offline. New charges and payments will queue until you reconnect."
          : `${pending} change${pending === 1 ? "" : "s"} waiting to sync.`}
      </p>
      {pending > 0 ? (
        <button type="button" className="offline-status-banner__btn" disabled={syncing || !online} onClick={() => void syncNow()}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      ) : null}
    </div>
  );
}
