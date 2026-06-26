"use client";

import { useEffect, useState } from "react";

type CronStatus = {
  configured: boolean;
  tasksScriptConfigured?: boolean;
  message: string;
};

export function CronDigestStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<CronStatus | null>(null);

  useEffect(() => {
    void fetch("/api/cron/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setStatus(json as CronStatus);
      })
      .catch(() => undefined);
  }, []);

  if (!status) return null;

  const tone = status.configured && status.tasksScriptConfigured ? "ok" : "warn";

  return (
    <p className={`cron-digest-status cron-digest-status--${tone}${compact ? " cron-digest-status--compact" : ""}`}>
      {status.message}
    </p>
  );
}
