"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { OfficeAnnouncementDraft } from "@/lib/sheets/settings";

type Props = {
  active: string | null;
  draft: OfficeAnnouncementDraft;
  isAdmin: boolean;
  onChange: (next: { active: string | null; draft: OfficeAnnouncementDraft }) => void;
};

export function OfficeHubAnnouncement({ active, draft, isAdmin, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(draft.message);
  const [from, setFrom] = useState(draft.from);
  const [until, setUntil] = useState(draft.until);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setMessage(draft.message);
      setFrom(draft.from);
      setUntil(draft.until);
    }
  }, [draft, editing]);

  const openEditor = useCallback(() => {
    setMessage(draft.message);
    setFrom(draft.from);
    setUntil(draft.until);
    setError("");
    setEditing(true);
  }, [draft]);

  const cancelEdit = useCallback(() => {
    setMessage(draft.message);
    setFrom(draft.from);
    setUntil(draft.until);
    setError("");
    setEditing(false);
  }, [draft]);

  const save = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { ok, data } = await fetchJson<{
        announcement: string | null;
        announcementDraft: OfficeAnnouncementDraft;
        error?: string;
      }>("/api/office-hub/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, from, until })
      });

      if (!ok || "error" in data) {
        throw new Error(("error" in data && data.error) || "Could not save announcement.");
      }

      onChange({
        active: data.announcement,
        draft: data.announcementDraft
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save announcement.");
    } finally {
      setBusy(false);
    }
  }, [from, message, onChange, until]);

  if (!active && !isAdmin) return null;

  if (editing) {
    return (
      <section className="office-hub__announcement-panel firm-auth-animate firm-auth-animate--2">
        <div className="office-hub__announcement-panel-head">
          <p className="office-hub__announcement-panel-title">Office notice</p>
          <p className="office-hub__announcement-panel-hint">Visible to all staff on Office Hub</p>
        </div>

        <label className="office-hub__announcement-field">
          <span>Message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={280}
            placeholder="e.g. Court closed Monday — work from home"
            className="office-hub__announcement-input office-hub__announcement-input--area"
          />
        </label>

        <div className="office-hub__announcement-dates">
          <label className="office-hub__announcement-field">
            <span>Show from (optional)</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="office-hub__announcement-input"
            />
          </label>
          <label className="office-hub__announcement-field">
            <span>Show until (optional)</span>
            <input
              type="date"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
              className="office-hub__announcement-input"
            />
          </label>
        </div>

        {error ? <p className="office-hub__announcement-error">{error}</p> : null}

        <div className="office-hub__announcement-actions">
          <button
            type="button"
            className="office-hub__announcement-btn office-hub__announcement-btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save notice"}
          </button>
          <button
            type="button"
            className="office-hub__announcement-btn"
            disabled={busy}
            onClick={cancelEdit}
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (active) {
    return (
      <div className="office-hub__announcement-wrap firm-auth-animate firm-auth-animate--2">
        <div className="office-hub__announcement" role="status">
          <div className="office-hub__announcement-body">
            <span className="office-hub__announcement-label">Notice</span>
            <span className="office-hub__announcement-text">{active}</span>
          </div>
          {isAdmin ? (
            <button type="button" className="office-hub__announcement-edit" onClick={openEditor}>
              Edit notice
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="office-hub__announcement-wrap firm-auth-animate firm-auth-animate--2">
        <div className="office-hub__announcement office-hub__announcement--empty">
          <div className="office-hub__announcement-body">
            <span className="office-hub__announcement-label">Notice</span>
            <span className="office-hub__announcement-text">No office announcement yet.</span>
          </div>
          <button type="button" className="office-hub__announcement-edit" onClick={openEditor}>
            Post a notice
          </button>
        </div>
      </div>
    );
  }

  return null;
}
