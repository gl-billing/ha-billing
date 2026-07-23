"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FIRM_AUTOMATION_SETTINGS,
  type FirmAutomationSettings
} from "@/lib/firm-automation-settings-shared";

const LABELS: Record<keyof FirmAutomationSettings, string> = {
  autoPostAppearanceOnCourtConfirm: "Auto-post appearance fee on court confirm",
  proactiveClientEventNotices: "Proactive client event notices",
  prepNudgeDaysBeforeHearing: "Prep nudge days before hearing",
  waitingClientEscalateDays: "Waiting-client escalate days",
  createCourtConfirmationTask: "Create court confirmation task",
  createPostHearingFollowUpTask: "Create post-hearing follow-up task",
  createFilingPrepReminderTask: "Create filing prep reminder task",
  createIntakeSeedTasks: "Create intake seed tasks"
};

const BOOL_KEYS: Array<keyof FirmAutomationSettings> = [
  "autoPostAppearanceOnCourtConfirm",
  "proactiveClientEventNotices",
  "createCourtConfirmationTask",
  "createPostHearingFollowUpTask",
  "createFilingPrepReminderTask",
  "createIntakeSeedTasks"
];

export function FirmAutomationSettingsPanel() {
  const [settings, setSettings] = useState<FirmAutomationSettings | null>(null);
  const [editable, setEditable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/firm/automation-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.settings) setSettings(json.settings as FirmAutomationSettings);
        else setSettings(DEFAULT_FIRM_AUTOMATION_SETTINGS);
        setEditable(Boolean(json?.editable));
      })
      .catch(() => setSettings(DEFAULT_FIRM_AUTOMATION_SETTINGS));
  }, []);

  const display = settings || DEFAULT_FIRM_AUTOMATION_SETTINGS;

  async function save(patch: Partial<FirmAutomationSettings>) {
    if (!editable || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/firm/automation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as { settings?: FirmAutomationSettings; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save.");
      if (json.settings) setSettings(json.settings);
      setStatus("Saved for this workspace.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card firm-automation-settings">
      <p className="section-label !mb-0">Firm automation</p>
      <h3 className="font-display text-lg text-ink">Workspace toggles</h3>
      <p className="mt-1 text-sm text-muted">
        Saved to this firm’s Settings sheet. Ops can still force values with Vercel{" "}
        <code className="text-[10px]">FIRM_*</code> env overrides.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {BOOL_KEYS.map((key) => (
          <li
            key={key}
            className="flex flex-col gap-2 rounded border border-line/70 bg-[#faf9f7] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium text-ink">{LABELS[key]}</span>
            <label className="inline-flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(display[key])}
                disabled={!editable || saving}
                onChange={(event) => {
                  const next = event.target.checked;
                  setSettings({ ...display, [key]: next });
                  void save({ [key]: next });
                }}
              />
              {display[key] ? "On" : "Off"}
            </label>
          </li>
        ))}
        {(
          [
            ["prepNudgeDaysBeforeHearing", 1, 30],
            ["waitingClientEscalateDays", 1, 90]
          ] as const
        ).map(([key, min, max]) => (
          <li
            key={key}
            className="flex flex-col gap-2 rounded border border-line/70 bg-[#faf9f7] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium text-ink">{LABELS[key]}</span>
            <input
              type="number"
              min={min}
              max={max}
              className="w-20 rounded border border-line px-2 py-1 text-sm"
              value={Number(display[key])}
              disabled={!editable || saving}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSettings({ ...display, [key]: value });
              }}
              onBlur={() => void save({ [key]: Number(display[key]) })}
            />
          </li>
        ))}
      </ul>
      {status ? <p className="mt-3 text-xs text-muted">{status}</p> : null}
      {!editable ? (
        <p className="mt-2 text-xs text-muted">Read-only right now — Sheets briefly unavailable.</p>
      ) : null}
    </section>
  );
}
