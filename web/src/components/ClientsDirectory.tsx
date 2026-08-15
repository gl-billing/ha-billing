"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientDirectoryPopup } from "@/components/ClientDirectoryPopup";
import { ClientListTable } from "@/components/ClientListTable";
import { MobileClientsList } from "@/components/mobile-app/MobileClientsList";
import { TableSkeleton } from "@/components/Skeleton";
import { useNativeMobileLayout } from "@/hooks/useNativeMobileLayout";
import { billingHref } from "@/lib/billing-routes";
import type { ClientSummary } from "@/lib/ha-config";

type Props = {
  busy?: boolean;
};

export function ClientsDirectory({ busy }: Props) {
  const router = useRouter();
  const nativeMobile = useNativeMobileLayout();
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
      if (includeClosed || nativeMobile) params.set("includeClosed", "1");

      const response = await fetch(`/api/clients?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load clients.");
      setClients(data.clients);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [query, includeClosed, nativeMobile]);

  useEffect(() => {
    const delay = query.trim() ? 250 : 0;
    const timer = window.setTimeout(() => void loadList(), delay);
    return () => window.clearTimeout(timer);
  }, [loadList, query]);

  function openClient(code: string) {
    setPopupCode(code.trim().toUpperCase());
  }

  if (nativeMobile) {
    return (
      <MobileClientsList
        clients={clients}
        query={query}
        onQueryChange={setQuery}
        busy={busy}
        refreshing={loading}
        onOpenIntake={() => router.push(billingHref({ page: "newClient" }))}
      />
    );
  }

  return (
    <>
      <div className="client-directory">
        <div className="client-directory__find">
          <label className="sr-only" htmlFor="client-directory-find">
            Find client
          </label>
          <input
            id="client-directory-find"
            className="field client-directory__find-input"
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Code, name, case title, email…"
            autoComplete="off"
            enterKeyHint="search"
          />
          <label className="client-directory__closed">
            <input
              type="checkbox"
              checked={includeClosed}
              disabled={busy}
              onChange={(e) => setIncludeClosed(e.target.checked)}
            />
            Include closed
          </label>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <ClientListTable clients={clients} busy={busy || loading} onOpenClient={openClient} />
        )}
      </div>

      <ClientDirectoryPopup clientCode={popupCode} onClose={() => setPopupCode(null)} />
    </>
  );
}
