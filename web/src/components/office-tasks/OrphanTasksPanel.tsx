"use client";

import { useCallback, useState } from "react";
import type { OrphanTaskItem } from "@/lib/office-tasks/orphan-tasks";

type Props = {
  busy?: boolean;
  onStatus: (message: string, isError?: boolean) => void;
};

export function OrphanTasksPanel({ busy, onStatus }: Props) {
  const [orphans, setOrphans] = useState<OrphanTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const itemKey = (item: OrphanTaskItem) => `${item.source}:${item.rowNumber}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/orphans");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed.");
      setOrphans(json.orphans || []);
      setSelected(new Set());
      setScanned(true);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Scan failed.", true);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  function toggle(item: OrphanTaskItem) {
    const key = itemKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function deleteSelected() {
    const items = orphans
      .filter((item) => selected.has(itemKey(item)))
      .map((item) => ({ source: item.source, rowNumber: item.rowNumber }));

    if (!items.length) {
      onStatus("Select at least one orphan item.", true);
      return;
    }

    if (!window.confirm(`Permanently delete ${items.length} orphan item(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/tasks/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed.");
      onStatus(json.message || "Deleted.");
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Delete failed.", true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="card tools-panel__section">
      <div className="health-checks-panel__header">
        <h2 className="section-label health-checks-panel__title">Orphan task cleaner</h2>
        <button type="button" className="health-checks-panel__refresh btn-secondary" disabled={loading || busy} onClick={() => void load()}>
          Rescan
        </button>
      </div>

      <p className="text-xs text-muted">
        Open tasks or hearings whose client/case does not match Master List or a firm matter (e.g. after a client was deleted).
      </p>

      {loading ? <p className="mt-2 text-xs text-muted">Scanning…</p> : null}

      {!loading && orphans.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          {scanned ? "No orphan items found." : "Click Scan to check for orphan rows (uses Google Sheets reads)."}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {orphans.map((item) => {
          const key = itemKey(item);
          return (
            <li key={key} className="rounded-md border border-line bg-white px-3 py-2 text-xs">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(item)} className="mt-0.5" />
                <span>
                  <span className="font-extrabold text-ink">
                    {item.id || item.source} · {item.clientCase}
                  </span>
                  <span className="mt-0.5 block text-muted">{item.reason}</span>
                  {item.details ? <span className="mt-0.5 block text-muted">{item.details}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {orphans.length ? (
        <button type="button" className="btn-gold mt-3 text-xs" disabled={deleting || busy || selected.size === 0} onClick={() => void deleteSelected()}>
          Delete selected ({selected.size})
        </button>
      ) : null}
    </section>
  );
}
