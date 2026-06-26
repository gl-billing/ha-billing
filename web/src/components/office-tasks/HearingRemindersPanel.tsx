"use client";

import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  getAndreaCourtConfirmationItems,
  getEscalationCandidates,
  resolveAndreaEmployee
} from "@/lib/hearing-escalation";
import { getEmployeeItemGroups } from "@/lib/office-tasks/schedule";

type Props = {
  items: OfficeItem[];
  today: string;
  busy: boolean;
  isAdmin: boolean;
  directory: EmployeeRecord[];
  onStatus: (msg: string, isError?: boolean) => void;
};

export function HearingRemindersPanel({ items, today, busy, isAdmin, directory, onStatus }: Props) {
  const escalation = getEscalationCandidates(items, today, 2);
  const andreaItems = getAndreaCourtConfirmationItems(items);
  const andrea = resolveAndreaEmployee(directory);
  const roster = directory.map((employee) => employee.name).filter(Boolean);
  const andreaOverdue = andrea ? getEmployeeItemGroups(andrea.name, items, today, [], roster).overdue.length : 0;

  async function sendReminders(scope: "both" | "escalation" | "andrea") {
    try {
      const res = await fetch("/api/cron/hearing-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send reminders.");
      onStatus(json.message || "Reminders sent.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to send reminders.", true);
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="card tools-panel__section">
      <h2 className="section-label">Hearing reminders</h2>
      <p className="tools-panel__section-desc">
        Escalation: items due within 48 hours. Andrea: overdue tasks plus scheduled hearings needing court
        confirmation call (overdue listed first in her email).
      </p>
      <div className="tools-panel__stat-grid">
        <div className="tools-panel__stat-box tools-panel__stat-box--warn">
          <p className="tools-panel__stat-label">Due in 48h</p>
          <p className="tools-panel__stat-value">{escalation.length}</p>
        </div>
        <div className="tools-panel__stat-box tools-panel__stat-box--info">
          <p className="tools-panel__stat-label">Andrea — call court</p>
          <p className="tools-panel__stat-value">{andreaItems.length}</p>
        </div>
        <div className="tools-panel__stat-box tools-panel__stat-box--warn">
          <p className="tools-panel__stat-label">Andrea — overdue</p>
          <p className="tools-panel__stat-value">{andreaOverdue}</p>
        </div>
      </div>
      <div className="tools-btn-grid">
        <button type="button" className="tool-action-btn" disabled={busy} onClick={() => void sendReminders("both")}>
          <span className="tool-action-btn__label">Send all hearing reminders</span>
        </button>
        <button type="button" className="tool-action-btn" disabled={busy} onClick={() => void sendReminders("andrea")}>
          <span className="tool-action-btn__label">Remind Andrea only</span>
        </button>
      </div>
      {andreaItems.length ? (
        <ul className="mt-4 space-y-1.5 text-xs text-muted">
          {andreaItems.slice(0, 5).map((item) => (
            <li key={`${item.sheetName}-${item.rowNumber}`}>
              {item.date} — {item.clientCase} · {item.venue || "Court TBD"}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
