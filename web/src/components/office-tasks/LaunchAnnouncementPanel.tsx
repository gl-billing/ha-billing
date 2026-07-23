"use client";

import { useState } from "react";
import { readJsonResponse } from "@/lib/fetch-json";

type Props = {
  busy: boolean;
  onStatus: (msg: string) => void;
};

type LaunchResult = {
  ok?: boolean;
  fromMailbox?: string;
  tokenVia?: string;
  sent?: string[];
  failed?: Array<{ email: string; error: string }>;
  error?: string;
};

/** Admin Tools — send the HA Office install announcement from legal@. */
export function LaunchAnnouncementPanel({ busy, onStatus }: Props) {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);

  async function sendLaunch() {
    if (sending || busy) return;
    const confirmed = window.confirm(
      "Send the HA Office install announcement to authorized staff from legal@hernandezlaw.info?"
    );
    if (!confirmed) return;

    setSending(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/launch-announcement", { method: "POST" });
      const json = await readJsonResponse<LaunchResult>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Unable to send launch announcement.");
      }
      setLastResult(json);
      const sentCount = json.sent?.length ?? 0;
      const failedCount = json.failed?.length ?? 0;
      onStatus(
        failedCount
          ? `Launch email sent to ${sentCount}; ${failedCount} failed.`
          : `Launch email sent to ${sentCount} recipients from ${json.fromMailbox || "legal@hernandezlaw.info"}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Launch email failed.";
      setLastResult({ error: message });
      onStatus(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card tools-panel__section">
      <h2 className="section-label">Staff launch email</h2>
      <p className="tools-panel__section-desc">
        Sends the install notice to authorized staff. Outbound From is{" "}
        <strong>legal@hernandezlaw.info</strong> (firm mailbox / Send-as). Prefer the firm cron token on
        Vercel so personal Gmail is never used.
      </p>
      <div className="tools-btn-grid">
        <button
          type="button"
          className="tool-action-btn tool-action-btn--primary"
          disabled={busy || sending}
          onClick={() => void sendLaunch()}
        >
          <span className="tool-action-btn__label">
            {sending ? "Sending…" : "Send HA Office launch email"}
          </span>
          <span className="tool-action-btn__sub">From legal@ · staff roster</span>
        </button>
      </div>
      {lastResult?.error ? (
        <p className="mt-3 text-sm text-red-800">{lastResult.error}</p>
      ) : null}
      {lastResult && !lastResult.error ? (
        <>
          <p className="mt-3 text-sm text-muted">
            Sent {lastResult.sent?.length ?? 0}
            {lastResult.failed?.length ? ` · failed ${lastResult.failed.length}` : ""}
            {lastResult.fromMailbox ? ` · mailbox ${lastResult.fromMailbox}` : ""}
            {lastResult.tokenVia ? ` · via ${lastResult.tokenVia}` : ""}
          </p>
          <pre className="mt-2 overflow-x-auto border border-[color:var(--line,#e0e0e0)] bg-[color:var(--paper,#fff)] p-3 text-xs text-ink whitespace-pre-wrap">
            {JSON.stringify(
              {
                ok: lastResult.ok,
                sent: lastResult.sent?.length ?? 0,
                failed: lastResult.failed?.length ?? 0,
                fromMailbox: lastResult.fromMailbox,
                sentEmails: lastResult.sent,
                failedEmails: lastResult.failed
              },
              null,
              2
            )}
          </pre>
        </>
      ) : null}
    </section>
  );
}
