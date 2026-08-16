"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentLogEntry } from "@/lib/ha-config";
import { formatPeso } from "@/lib/ha-config";
import { truncateForDisplay } from "@/lib/link-display";
import {
  DRIVE_VAULT_FOLDERS,
  matchesDriveVaultFolder,
  type DriveVaultFolderId
} from "@/lib/drive-vault-folders";

type Props = {
  clientCode?: string;
  busy?: boolean;
  /** Compact list under issue SOA/AR on Drive tab. */
  limit?: number;
  /** Emphasize folder taxonomy (Drive Space). */
  vaultMode?: boolean;
};

/** Drive tab vault — Document Log entries with folder classification + PDF links. */
export function DocumentVaultPanel({ clientCode, busy, limit = 40, vaultMode = false }: Props) {
  const [entries, setEntries] = useState<DocumentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DriveVaultFolderId>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(Math.max(limit, 80)) });
      if (clientCode?.trim()) params.set("clientCode", clientCode.trim());
      const res = await fetch(`/api/documents/log?${params}`);
      const data = (await res.json()) as { entries?: DocumentLogEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load Drive document log.");
      setEntries(data.entries || []);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : "Could not load Drive document log.");
    } finally {
      setLoading(false);
    }
  }, [clientCode, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<DriveVaultFolderId, number>();
    for (const folder of DRIVE_VAULT_FOLDERS) {
      if (folder.id === "all") {
        map.set("all", entries.length);
        continue;
      }
      map.set(
        folder.id,
        entries.filter((entry) => matchesDriveVaultFolder(entry.documentType, folder.id)).length
      );
    }
    return map;
  }, [entries]);

  const visible = useMemo(
    () => entries.filter((entry) => matchesDriveVaultFolder(entry.documentType, filter)).slice(0, limit),
    [entries, filter, limit]
  );

  return (
    <section className="card mt-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label mb-0">{vaultMode ? "Drive folders" : "Drive vault"}</p>
          <p className="mt-1 text-sm text-muted">
            {vaultMode
              ? "Outbound PDFs classified into Status Reports, NR, correspondence, engagement, and other firm folders. Open a link to view in Google Drive."
              : "PDFs saved when letters, engagement docs, and other outbound documents are sent. Open a link to view in Google Drive."}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Drive folders">
        {DRIVE_VAULT_FOLDERS.map(({ id, label }) => {
          const count = counts.get(id) ?? 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              disabled={busy}
              className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                filter === id
                  ? "bg-ink text-white"
                  : "border border-line text-ink hover:bg-[#f5f3ef]"
              }`}
              onClick={() => setFilter(id)}
            >
              {label}
              {id !== "all" ? (
                <span className={`ml-1 ${filter === id ? "text-white/70" : "text-muted"}`}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? <p className="text-sm text-muted">Loading document log…</p> : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <p className="text-sm text-muted">
          {filter === "status-report"
            ? "No Status Report PDFs yet. Matter status text currently ships with SOA emails; this folder fills when dedicated status-report PDFs are saved."
            : filter === "all"
              ? `No saved PDFs yet${clientCode ? " for this client" : ""}. Issue an SOA or send a letter to populate this list.`
              : `No ${DRIVE_VAULT_FOLDERS.find((f) => f.id === filter)?.label || "documents"} in the log yet.`}
        </p>
      ) : null}

      {!loading && visible.length > 0 ? (
        <ul className="divide-y divide-[color:var(--line)]">
          {visible.map((entry) => (
            <li
              key={entry.logRow}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  <span className="text-gold-dark">{entry.documentType || "Document"}</span>
                  {entry.documentNumber ? ` · ${entry.documentNumber}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {[entry.clientCode !== "—" ? entry.clientCode : null, entry.clientName, entry.timestamp]
                    .filter(Boolean)
                    .join(" · ")}
                  {entry.status ? ` · ${entry.status}` : ""}
                  {entry.amount > 0 ? ` · ${formatPeso(entry.amount)}` : ""}
                </p>
              </div>
              {entry.pdfUrl ? (
                <a
                  href={entry.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-gold-dark underline-offset-2 hover:underline"
                >
                  {truncateForDisplay(entry.pdfUrl, 28) || "Open PDF"}
                </a>
              ) : (
                <span className="shrink-0 text-xs text-muted">No link</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
