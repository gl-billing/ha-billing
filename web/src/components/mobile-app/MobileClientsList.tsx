"use client";

import { useMemo, useState } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import { MobileEmptyState } from "@/components/mobile-app/MobileEmptyState";
import { MobileFilterBar } from "@/components/mobile-app/MobileFilterBar";
import { MobilePageHeader } from "@/components/mobile-app/MobilePageHeader";
import { MobileRecordCard } from "@/components/mobile-app/MobileRecordCard";
import { billingHref } from "@/lib/billing-routes";
import type { ClientSummary } from "@/lib/ha-config";
import { formatPeso } from "@/lib/ha-config";
import { formatMatterDirectoryCaseLabel } from "@/lib/client-matter-type";
import { matterHref } from "@/lib/matter-routes";
import { mobileClientsListHref } from "@/lib/mobile-app-nav";
import styles from "./mobile-app.module.css";

type StatusFilter = "all" | "active" | "closed";

type Props = {
  clients: ClientSummary[];
  query: string;
  onQueryChange: (value: string) => void;
  busy?: boolean;
  refreshing?: boolean;
  loadError?: string;
  onOpenIntake?: () => void;
};

export function MobileClientsList({
  clients,
  query,
  onQueryChange,
  busy,
  refreshing,
  loadError,
  onOpenIntake
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const from = mobileClientsListHref();

  const rows = useMemo(() => {
    let list = clients;
    if (statusFilter === "active") {
      list = list.filter((client) => client.status.toLowerCase() !== "closed");
    } else if (statusFilter === "closed") {
      list = list.filter((client) => client.status.toLowerCase() === "closed");
    }
    return list;
  }, [clients, statusFilter]);

  const intakeAction =
    !query.trim() && statusFilter !== "closed" ? (
      onOpenIntake ? (
        <button type="button" className="ha-mobile-primary-btn" disabled={busy} onClick={onOpenIntake}>
          Open Intake
        </button>
      ) : (
        <SameWindowLink href={billingHref({ page: "newClient" })} className="ha-mobile-primary-btn">
          Open Intake
        </SameWindowLink>
      )
    ) : null;

  return (
    <section className={`ha-mobile-app ${styles.page}`} aria-label="Clients">
      <MobilePageHeader title="Clients" />
      <input
        className={styles.search}
        value={query}
        disabled={busy}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search code, name, or matter"
        aria-label="Search clients"
      />
      <MobileFilterBar
        ariaLabel="Client status"
        value={statusFilter}
        disabled={busy}
        onChange={setStatusFilter}
        options={[
          { id: "all", label: "All" },
          { id: "active", label: "Active" },
          { id: "closed", label: "Closed" }
        ]}
      />
      <p className={styles.count}>
        {rows.length} {rows.length === 1 ? "client" : "clients"}
        {refreshing ? " · refreshing…" : ""}
      </p>
      {loadError ? (
        <p className={styles.status} role="alert">
          {loadError}
        </p>
      ) : null}
      {!rows.length ? (
        <MobileEmptyState
          message={
            query.trim()
              ? "No clients match your search."
              : statusFilter === "closed"
                ? "No closed clients."
                : "No clients yet."
          }
          action={intakeAction}
        />
      ) : (
        <ul className={styles.list}>
          {rows.map((client, index) => (
            <li key={`${client.code}-${index}`}>
              <MobileRecordCard
                href={matterHref(client.code, undefined, { from })}
                eyebrow={client.code}
                badge={client.status || "Active"}
                badgeMuted={client.status.toLowerCase() === "closed"}
                title={client.name || client.code}
                subtitle={formatMatterDirectoryCaseLabel(client)}
                meta={`Outstanding balance: ${formatPeso(client.balance)}`}
                metaAlert={client.balance > 0}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
