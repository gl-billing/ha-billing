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

function clientStatus(client: ClientSummary): string {
  return String(client.status || "Active");
}

function isClosedClient(client: ClientSummary): boolean {
  return clientStatus(client).toLowerCase() === "closed";
}

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
      list = list.filter((client) => !isClosedClient(client));
    } else if (statusFilter === "closed") {
      list = list.filter((client) => isClosedClient(client));
    }
    return list;
  }, [clients, statusFilter]);

  const intakeHref = billingHref({ page: "newClient" });
  const headerIntake = onOpenIntake ? (
    <button type="button" className="ha-mobile-header-btn" disabled={busy} onClick={onOpenIntake}>
      + Intake
    </button>
  ) : (
    <SameWindowLink href={intakeHref} className="ha-mobile-header-btn">
      + Intake
    </SameWindowLink>
  );

  const emptyIntake =
    !query.trim() && statusFilter !== "closed" ? (
      onOpenIntake ? (
        <button type="button" className="ha-mobile-primary-btn" disabled={busy} onClick={onOpenIntake}>
          Open Intake
        </button>
      ) : (
        <SameWindowLink href={intakeHref} className="ha-mobile-primary-btn">
          Open Intake
        </SameWindowLink>
      )
    ) : null;

  const initialLoad = Boolean(refreshing && !clients.length && !loadError);

  return (
    <section className={`ha-mobile-app clients-page--native-mobile ${styles.page}`} aria-label="Clients">
      <MobilePageHeader title="Clients" action={headerIntake} />
      <input
        type="search"
        className={`${styles.search} clients-page__search`}
        value={query}
        disabled={busy}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search code, name, or matter"
        aria-label="Search clients"
        autoComplete="off"
        enterKeyHint="search"
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
        {initialLoad ? "Loading clients…" : `${rows.length} ${rows.length === 1 ? "client" : "clients"}`}
        {refreshing && clients.length ? " · refreshing…" : ""}
      </p>
      {loadError ? (
        <p className={styles.status} role="alert">
          {loadError}
        </p>
      ) : null}
      {initialLoad ? null : rows.length ? (
        <ul className={styles.list}>
          {rows.map((client, index) => (
            <li key={`${client.code}-${index}`}>
              <MobileRecordCard
                href={matterHref(client.code, undefined, { from })}
                eyebrow={client.code}
                badge={clientStatus(client)}
                badgeMuted={isClosedClient(client)}
                title={client.name || client.code}
                subtitle={formatMatterDirectoryCaseLabel(client)}
                meta={`Outstanding balance: ${formatPeso(client.balance)}`}
                metaAlert={client.balance > 0}
              />
            </li>
          ))}
        </ul>
      ) : loadError ? null : (
        <MobileEmptyState
          message={
            query.trim()
              ? "No clients match your search."
              : statusFilter === "closed"
                ? "No closed clients."
                : "No clients yet."
          }
          action={emptyIntake}
        />
      )}
    </section>
  );
}
