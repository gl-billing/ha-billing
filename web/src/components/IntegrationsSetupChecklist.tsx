"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeskConnector, DeskConnectorId } from "@/lib/integrations/desk-connectors";
import { DESK_CONNECTOR_IDS } from "@/lib/integrations/desk-connectors";

type ChecklistRow = {
  status?: string;
  message?: string;
  ok?: boolean;
  configured?: boolean;
};

type StatusPayload = {
  checklist?: Record<string, ChecklistRow>;
  connectors?: Record<string, DeskConnector>;
};

type CheckItem = {
  id: DeskConnectorId;
  label: string;
  detail: string;
  ok?: boolean;
};

const FALLBACK: CheckItem[] = [
  {
    id: "google",
    label: "Google (Calendar & Gmail)",
    detail: "Staff sign in with Google; calendar sync uses the signed-in account."
  },
  {
    id: "sheets",
    label: "Google Sheets",
    detail: "Billing and tasks spreadsheet IDs must be configured for this workspace."
  },
  {
    id: "storage",
    label: "Document storage",
    detail: "Drive folder in firm settings when you want automatic document copies."
  }
];

export function IntegrationsSetupChecklist() {
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  const load = useCallback(() => {
    void fetch("/api/integrations/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setPayload(json as StatusPayload);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = FALLBACK.map((item) => {
    const live = payload?.checklist?.[item.id] || payload?.connectors?.[item.id];
    if (!live) return item;
    const ok = live.ok === true || live.status === "ok";
    return {
      ...item,
      ok: live.status || live.ok !== undefined ? ok : undefined,
      detail: ("message" in live && live.message?.trim()) || item.detail
    };
  });

  const ordered = DESK_CONNECTOR_IDS.map((id) => items.find((item) => item.id === id)!).filter(Boolean);

  return (
    <section className="integrations-setup-checklist" aria-label="Integration setup checklist">
      <p className="integrations-setup-checklist__title">Setup checklist</p>
      <ul className="integrations-setup-checklist__list">
        {ordered.map((item) => (
          <li key={item.id} className="integrations-setup-checklist__item">
            <span
              className={`integrations-setup-checklist__status${
                item.ok === true
                  ? " integrations-setup-checklist__status--ok"
                  : item.ok === false
                    ? " integrations-setup-checklist__status--warn"
                    : ""
              }`}
              aria-hidden
            />
            <div className="integrations-setup-checklist__body">
              <p className="integrations-setup-checklist__label">{item.label}</p>
              <p className="integrations-setup-checklist__detail">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
