"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientDirectoryPopup } from "@/components/ClientDirectoryPopup";
import { ClientListTable } from "@/components/ClientListTable";
import { TableSkeleton } from "@/components/Skeleton";
import type { ClientSummary } from "@/lib/gl-config";

type Props = {
  busy?: boolean;
};

export function ClientsDirectory({ busy }: Props) {
  const [query, setQuery] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [popupCode, setPopupCode] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeClosed) params.set("includeClosed", "1");

      const response = await fetch(`/api/clients?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load clients.");
      setClients(data.clients);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [query, includeClosed]);

  useEffect(() => {
    const delay = query.trim() ? 250 : 0;
    const timer = window.setTimeout(() => void loadList(), delay);
    return () => window.clearTimeout(timer);
  }, [loadList, query]);

  function openClient(code: string) {
    setPopupCode(code.trim().toUpperCase());
  }

  return (
    <>
      <section className="card space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">Find client</label>
          <input
            className="field"
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Code, name, case title, email..."
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={includeClosed}
              disabled={busy}
              onChange={(e) => setIncludeClosed(e.target.checked)}
            />
            Include closed clients
          </label>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <ClientListTable clients={clients} busy={busy || loading} onOpenClient={openClient} />
        )}
      </section>

      <ClientDirectoryPopup clientCode={popupCode} onClose={() => setPopupCode(null)} />
    </>
  );
}
