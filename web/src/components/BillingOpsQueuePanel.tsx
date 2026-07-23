"use client";

import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { useCallback, useEffect, useState } from "react";
import {
  BILLING_OPS_BUCKET_LABELS,
  type BillingOpsQueue,
  type BillingOpsQueueItem
} from "@/lib/billing-ops-queue";
import type { HomeNavigate } from "@/components/HomeDashboard";

type Props = {
  busy: boolean;
  onNavigate: (nav: HomeNavigate) => void;
};

function bucketLabel(item: BillingOpsQueueItem): string {
  return BILLING_OPS_BUCKET_LABELS[item.bucket];
}

export function BillingOpsQueuePanel({ busy, onNavigate }: Props) {
  const [queue, setQueue] = useState<BillingOpsQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/ops-queue");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load ops queue.");
      setQueue(json as BillingOpsQueue);
    } catch (err) {
      setQueue(null);
      setError(err instanceof Error ? err.message : "Unable to load ops queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openItem(item: BillingOpsQueueItem) {
    onNavigate({
      page: item.navigate.page,
      clientCode: item.navigate.clientCode,
      docTab: item.navigate.docTab
    });
  }

  if (loading && !queue) {
    return (
      <section className="billing-ops-queue card page-stagger__item">
        <Skeleton className="h-48 w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="billing-ops-queue card page-stagger__item">
        <p className="text-sm text-red-800">{error}</p>
        <button type="button" className="btn-gold mt-3" disabled={busy} onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  if (!queue) return null;

  return (
    <section className="billing-ops-queue card page-stagger__item">
      <div className="billing-ops-queue__head">
        <div>
          <p className="billing-ops-queue__eyebrow">Andrea billing ops</p>
          <h3 className="billing-ops-queue__title font-display">Ops queue</h3>
          <p className="billing-ops-queue__lede">
            Overdue SOA, pending AR, follow-ups, billing tasks, walk-ins, and notarizations in one place.
          </p>
        </div>
        <div className="billing-ops-queue__stats">
          <span className="billing-ops-queue__stat">
            <strong>{queue.totalCount}</strong> open
          </span>
          {queue.urgentCount > 0 ? (
            <span className="billing-ops-queue__stat billing-ops-queue__stat--urgent">
              <strong>{queue.urgentCount}</strong> urgent
            </span>
          ) : null}
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} onClick={() => void load()}>
            Update
          </button>
        </div>
      </div>

      {queue.items.length === 0 ? (
        <EmptyState
          title="All caught up"
          message="No billing ops waiting right now — overdue SOA, AR, follow-ups, and tasks are clear."
        />
      ) : (
        <ul className="billing-ops-queue__list">
          {queue.items.slice(0, 24).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`billing-ops-queue__row ${item.priority === "urgent" ? "billing-ops-queue__row--urgent" : ""}`}
                disabled={busy}
                onClick={() => openItem(item)}
              >
                <span className="billing-ops-queue__bucket">{bucketLabel(item)}</span>
                <span className="billing-ops-queue__copy">
                  <span className="billing-ops-queue__row-title">{item.title}</span>
                  <span className="billing-ops-queue__row-sub">{item.subtitle}</span>
                </span>
                <span className="billing-ops-queue__meta">{item.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
