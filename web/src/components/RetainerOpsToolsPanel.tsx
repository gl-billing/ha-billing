"use client";

import { useState } from "react";

/** Admin/ops tools for retainer digests — lives under Reports, not Billing Home. */
export function RetainerOpsToolsPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function previewDigest() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/retainers/setup?preview=1");
      const json = (await res.json()) as {
        error?: string;
        eveDigest?: { oneLiner?: string };
      };
      if (!res.ok) throw new Error(json.error || "Could not load digest preview.");
      setMessage(json.eveDigest?.oneLiner || "No retainer dues tomorrow.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load digest preview.");
    } finally {
      setBusy(false);
    }
  }

  async function dryRunBilling() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/retainers/setup?dryRun=1");
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error || "Dry-run failed.");
      setMessage(json.message || "Dry-run complete.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Dry-run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <p className="section-label !mb-0">Retainer automation</p>
      <h3 className="font-display text-lg text-ink">Preview digest &amp; dry-run</h3>
      <p className="mt-1 text-sm text-muted">
        Ops tools for tomorrow&apos;s eve digest and due-date billing. Upcoming dues stay on Billing Home.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => void previewDigest()}
        >
          Preview digest
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => void dryRunBilling()}
        >
          Dry-run billing
        </button>
      </div>
      {message ? <p className="mt-3 text-xs text-muted">{message}</p> : null}
    </section>
  );
}
