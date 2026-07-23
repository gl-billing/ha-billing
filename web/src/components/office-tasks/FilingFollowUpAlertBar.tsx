"use client";

import { useEffect, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { useFirmAdmin } from "@/hooks/useFirmAdmin";
import {
  filingAlertHeadline,
  filingDeadlineBadgeLabel,
  type FilingDeadlineAlert
} from "@/lib/office-tasks/filing-confirmation";
import { formatDisplayDate, officeItemKey } from "@/lib/office-tasks/schedule";

type Props = {
  alerts: FilingDeadlineAlert[];
  busyKey?: string | null;
  onMarkSubmitted: (item: ItemSummary) => void;
  /** Collapse when this changes (e.g. active tasks tab). */
  collapseKey?: string | number;
};

export function FilingFollowUpAlertBar({ alerts, busyKey, onMarkSubmitted, collapseKey }: Props) {
  const isAdmin = useFirmAdmin();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [collapseKey]);
  const listId = "filing-followup-alert-list";

  if (!alerts.length) return null;

  return (
    <section
      className={`filing-followup-alert no-print ${open ? "filing-followup-alert--open" : ""}`}
      aria-label="Filing deadlines"
    >
      <button
        type="button"
        className="filing-followup-alert__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="filing-followup-alert__icon" aria-hidden>
          !
        </span>
        <div className="filing-followup-alert__headline">
          <strong className="filing-followup-alert__title">Filings due</strong>
          <span className="filing-followup-alert__summary">{filingAlertHeadline(alerts)}</span>
        </div>
        <span className="filing-followup-alert__toggle-action" aria-hidden>
          <span className="filing-followup-alert__count">{alerts.length}</span>
          <span className="filing-followup-alert__toggle-label">{open ? "Hide" : "Show"}</span>
          <span className={`filing-followup-alert__chevron ${open ? "filing-followup-alert__chevron--open" : ""}`}>
            ▼
          </span>
        </span>
      </button>

      <ul id={listId} className={`filing-followup-alert__list ${open ? "" : "hidden"}`}>
        {alerts.map(({ item, urgency, deadline, needsConfirmation }) => {
          const key = officeItemKey(item);
          const busy = busyKey === key;
          const matter = item.clientCase?.trim() || "Client matter";
          const kind = item.category?.trim() || "Filing";

          return (
            <li
              key={key}
              className={`filing-followup-alert__item filing-followup-alert__item--${urgency}`}
            >
              <span className={`filing-followup-alert__badge filing-followup-alert__badge--${urgency}`}>
                {filingDeadlineBadgeLabel(urgency, formatDisplayDate(deadline, "short"))}
              </span>
              <span className="filing-followup-alert__item-title">
                {matter} · {kind}
              </span>
              <span className="filing-followup-alert__item-deadline">{formatDisplayDate(deadline, "short")}</span>
              {needsConfirmation && isAdmin ? (
                <button
                  type="button"
                  className="filing-followup-alert__btn"
                  disabled={busy}
                  onClick={() => onMarkSubmitted(item)}
                >
                  {busy ? "…" : "Mark filed"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
