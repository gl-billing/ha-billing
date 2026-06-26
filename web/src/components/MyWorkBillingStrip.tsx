"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientCodeButton } from "@/components/ClientCodeButton";
import { SameWindowLink } from "@/components/SameWindowLink";
import { billingHref, billingTodoHref } from "@/lib/billing-routes";
import { fetchJson } from "@/lib/fetch-json";
import type { MyWorkBillingSummary } from "@/lib/my-work-billing";
import { EmptyState } from "@/components/office-tasks/PremiumUI";

type Props = {
  className?: string;
  /** Inside My work step card — hides duplicate title block. */
  embedded?: boolean;
};

export function MyWorkBillingStrip({ className = "", embedded = false }: Props) {
  const [data, setData] = useState<MyWorkBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { ok, data: json } = await fetchJson<MyWorkBillingSummary & { error?: string }>(
        "/api/my-work/billing"
      );
      if (!ok) throw new Error(json.error || "Could not load billing to do's.");
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load billing to do's.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rootClass = ["my-work-billing", "no-print", embedded ? "my-work-billing--embedded" : "", className]
    .filter(Boolean)
    .join(" ");

  if (loading && !data) {
    return (
      <section className={rootClass} aria-busy="true">
        {embedded ? null : <p className="my-work-billing__eyebrow">Billing to do&apos;s</p>}
        <p className="my-work-billing__loading">Loading collections and receipts…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={rootClass}>
        {embedded ? null : <p className="my-work-billing__eyebrow">Billing to do&apos;s</p>}
        <p className="my-work-billing__loading">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const overdue = data.overdue ?? [];
  const followUp = data.followUp ?? [];
  const pendingAr = data.pendingAr ?? [];
  const overdueCount = data.overdueCount ?? overdue.length;
  const followUpCount = data.followUpCount ?? followUp.length;
  const pendingArCount = data.pendingArCount ?? pendingAr.length;
  const total = overdueCount + followUpCount + pendingArCount;

  return (
    <section className={rootClass}>
      {embedded ? (
        <div className="my-work-billing__head my-work-billing__head--embedded">
          <p className="my-work-billing__scope">
            {data.scope === "firm" ? "Firm-wide" : "Your assigned clients"} · SOA, AR, collections
          </p>
          <SameWindowLink href={billingHref({ page: "home" })} className="my-work-billing__dashboard-link">
            Dashboard →
          </SameWindowLink>
        </div>
      ) : (
        <div className="my-work-billing__head">
          <div>
            <p className="my-work-billing__eyebrow">Billing to do&apos;s</p>
            <p className="my-work-billing__scope">
              {data.scope === "firm" ? "Firm-wide" : "Your assigned clients"} · SOA, AR, collections
            </p>
          </div>
          <SameWindowLink href={billingHref({ page: "home" })} className="my-work-billing__dashboard-link">
            Dashboard →
          </SameWindowLink>
        </div>
      )}

      <div className="my-work-billing__stats">
        <BillingStat label="Overdue / SOA" value={overdueCount} tone="alert" />
        <BillingStat label="AR pending" value={pendingArCount} tone="gold" />
        <BillingStat label="Follow-ups" value={followUpCount} tone="neutral" />
      </div>

      {total === 0 ? (
        <EmptyState compact message="No urgent billing items in your queue." />
      ) : (
        <div className="my-work-billing__lists">
          {overdue.length > 0 ? (
            <BillingList kind="overdue" title="Overdue — send SOA / collect" items={overdue} />
          ) : null}
          {pendingAr.length > 0 ? (
            <BillingList kind="pending_ar" title="Payments — issue AR" items={pendingAr} />
          ) : null}
          {followUp.length > 0 ? (
            <BillingList kind="follow_up" title="Collections follow-up this week" items={followUp} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function BillingStat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "alert" | "gold" | "neutral";
}) {
  return (
    <div className={`my-work-billing__stat my-work-billing__stat--${tone}`}>
      <span className="my-work-billing__stat-value">{value}</span>
      <span className="my-work-billing__stat-label">{label}</span>
    </div>
  );
}

function BillingList({
  kind,
  title,
  items
}: {
  kind: "overdue" | "pending_ar" | "follow_up";
  title: string;
  items: MyWorkBillingSummary["overdue"];
}) {
  const actionLabel =
    kind === "overdue" ? "Send SOA" : kind === "pending_ar" ? "Issue AR" : "Open billing";

  return (
    <div className="my-work-billing__list">
      <p className="my-work-billing__list-title">{title}</p>
      <ul className="my-work-billing__items">
        {items.map((item) => (
          <li key={item.id} className="my-work-billing__item">
            <div className="my-work-billing__item-copy">
              <p className="my-work-billing__item-name">
                <ClientCodeButton code={item.code} className="no-underline" /> — {item.name}
              </p>
              <p className="my-work-billing__item-meta">{item.meta}</p>
            </div>
            <SameWindowLink href={billingTodoHref(kind, item.code)} className="my-work-billing__item-link">
              {actionLabel}
            </SameWindowLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
