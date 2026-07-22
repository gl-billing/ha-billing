"use client";

import { useMemo, useState } from "react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { ClientBirthdayCake } from "@/components/ClientBirthdayCake";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import type { ClientSummary } from "@/lib/gl-config";
import { formatMatterDirectoryCaseLabel } from "@/lib/client-matter-type";
import { isBirthdayToday } from "@/lib/birthday-greeting";

type SortKey = "code" | "name" | "caseTitle" | "balance" | "status" | "accountStatus";
type SortDir = "asc" | "desc";

type Props = {
  clients: ClientSummary[];
  busy?: boolean;
  onOpenClient: (code: string) => void;
};

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "active") return "matter-status-badge--active";
  if (normalized === "closed") return "matter-status-badge--closed";
  if (normalized === "inactive") return "matter-status-badge--inactive";
  return "matter-status-badge--default";
}

export function ClientListTable({ clients, busy, onOpenClient }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");

  const sorted = useMemo(() => {
    let list = [...clients];
    if (statusFilter === "active") {
      list = list.filter((c) => c.status.toLowerCase() !== "closed");
    } else if (statusFilter === "closed") {
      list = list.filter((c) => c.status.toLowerCase() === "closed");
    }

    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "balance") {
        av = a.balance;
        bv = b.balance;
      } else {
        av = String(a[sortKey] || "").toLowerCase();
        bv = String(b[sortKey] || "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [clients, sortKey, sortDir, statusFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortBtn({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <button
        type="button"
        disabled={busy}
        className={`text-left text-[11px] font-semibold ${active ? "text-gold-dark" : "text-muted"}`}
        onClick={() => toggleSort(col)}
      >
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </button>
    );
  }

  if (!clients.length) {
    return (
      <EmptyState
        title="No clients yet"
        message="Add your first matter from the New tab to start building the directory."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["all", "All"],
            ["active", "Active"],
            ["closed", "Closed"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            className={`field-dispatch-panel__filter-btn ${
              statusFilter === id ? "field-dispatch-panel__filter-btn--active" : ""
            }`}
            onClick={() => setStatusFilter(id)}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-[10px] text-muted">{sorted.length} clients</span>
      </div>

      <div className="scroll-panel-hint firm-ledger-table-wrap overflow-x-auto">
        <table className="client-list-table firm-ledger-table firm-ledger-table--responsive-stack w-full min-w-[42rem] text-left text-xs">
          <thead>
            <tr>
              <th className="client-list-table__col-code py-2"><SortBtn label="Code" col="code" /></th>
              <th className="client-list-table__col-name py-2"><SortBtn label="Name" col="name" /></th>
              <th className="client-list-table__col-case px-2 py-2">
                <SortBtn label="Case / matter" col="caseTitle" />
              </th>
              <th className="client-list-table__col-balance px-2 py-2 text-right">
                <div className="text-right">
                  <SortBtn label="Balance" col="balance" />
                </div>
              </th>
              <th className="client-list-table__col-status px-2 py-2"><SortBtn label="Status" col="status" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((client, index) => (
                <tr
                  key={`${client.code}-${index}`}
                  className="client-list-row"
                  onClick={() => onOpenClient(client.code)}
                >
                  <td data-label="Code" className="client-list-table__col-code py-2">
                    <button
                      type="button"
                      className="client-code-link font-bold text-ink no-underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenClient(client.code);
                      }}
                    >
                      {client.code}
                    </button>
                  </td>
                  <td data-label="Name" className="client-list-table__col-name py-2">
                    <button
                      type="button"
                      className="client-list-row__name-cell"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenClient(client.code);
                      }}
                    >
                      <span className="client-list-row__name-line" title={client.name || undefined}>
                        <span className="client-list-row__name">{client.name || "—"}</span>
                        {isBirthdayToday(client.birthday) ? <ClientBirthdayCake /> : null}
                      </span>
                    </button>
                  </td>
                  <td data-label="Case / matter" className="client-list-table__col-case px-2 py-2">
                    <span
                      className="client-list-row__case-cell"
                      title={formatMatterDirectoryCaseLabel(client)}
                    >
                      {formatMatterDirectoryCaseLabel(client)}
                    </span>
                  </td>
                  <td data-label="Balance" className="client-list-table__col-balance px-2 py-2 text-right">
                    <AmountDisplay
                      value={client.balance}
                      className={`client-list-table__balance-amount ${client.balance > 0 ? "text-[#8b1e1e]" : "text-muted"}`}
                    />
                  </td>
                  <td data-label="Status" className="client-list-table__col-status px-2 py-2">
                    <span className={`matter-status-badge ${statusBadgeClass(client.status)}`}>
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
