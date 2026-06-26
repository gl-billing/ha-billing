"use client";

import { useMemo, useState } from "react";
import type { ClientSummary } from "@/lib/gl-config";
import { filterClientsByQuery } from "@/lib/gl-config";

type Props = {
  clients: ClientSummary[];
  disabled?: boolean;
  onSelect: (clientCode: string, target: "clients" | "billing" | "documents") => void;
};

export function GlobalSearch({ clients, disabled, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return filterClientsByQuery(clients, query).slice(0, 8);
  }, [clients, query]);

  return (
    <div className="relative mb-4">
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted">
        Search clients
      </label>
      <input
        className="field"
        value={query}
        disabled={disabled}
        placeholder="Code, name, case, court, email..."
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-premium">
          {results.length ? (
            results.map((client) => (
              <div
                key={client.code}
                className="border-b border-line/60 px-3 py-2 last:border-b-0 hover:bg-soft"
              >
                <p className="text-sm font-bold text-ink">
                  {client.code} — {client.name}
                </p>
                <p className="truncate text-[11px] text-muted">{client.caseTitle}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-gold"
                    onMouseDown={() => {
                      onSelect(client.code, "clients");
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    onMouseDown={() => {
                      onSelect(client.code, "billing");
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    Billing
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    onMouseDown={() => {
                      onSelect(client.code, "documents");
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    SOA / AR
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="px-3 py-3 text-xs text-muted">No clients match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
