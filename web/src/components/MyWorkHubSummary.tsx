"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import type { OfficeHubSummary } from "@/lib/office-hub/summary";
import type { MyWorkBillingSummary } from "@/lib/my-work-billing";
import { buildMyWorkHubItems } from "@/lib/my-work-hub-items";
import { readJsonResponse } from "@/lib/fetch-json";
import { cachedFetchJson } from "@/lib/client-fetch-cache";
import { firmAppHref } from "@/lib/firm-apps";

type Props = {
  summary: OfficeHubSummary;
  billingAccess: boolean;
  loading?: boolean;
    tasksHref?: string;
  billingHref?: string;
};

export function MyWorkHubSummary({
  summary,
  billingAccess,
  loading,
    tasksHref = firmAppHref("/app?tab=today"),
  billingHref = "/billing"
}: Props) {
  const [billing, setBilling] = useState<MyWorkBillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!billingAccess ) return;
    setBillingLoading(true);
    try {
      const { data } = await cachedFetchJson("my-work-billing", async () => {
        const res = await fetch("/api/my-work/billing");
        const json = await readJsonResponse<MyWorkBillingSummary & { error?: string }>(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing summary.");
        if (!json) throw new Error("Failed to load billing summary.");
        return json;
      });
      setBilling(data);
    } catch {
      /* optional on hub */
    } finally {
      setBillingLoading(false);
    }
  }, [billingAccess]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const items = useMemo(
    () => buildMyWorkHubItems({ summary, billing, billingAccess }),
    [summary, billing, billingAccess]
  );

  const busy = loading || billingLoading;

  return (
    <section className="my-work-hub-summary" aria-label="My work summary">
      <div className="my-work-hub-summary__head">
        <p className="my-work-hub-summary__title">My work</p>
        <SameWindowLink href={tasksHref} className="my-work-hub-summary__cta">
          Open full queue →
        </SameWindowLink>
      </div>
      {busy && !items.length ? (
        <p className="my-work-hub-summary__status">Loading your queue…</p>
      ) : items.length ? (
        <ul className="my-work-hub-summary__list">
          {items.map((item) => (
            <li key={item.id}>
              <SameWindowLink href={item.href} className="my-work-hub-summary__link">
                {item.label}
              </SameWindowLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="my-work-hub-summary__status">You&apos;re caught up — open your queue for the full list.</p>
      )}
    </section>
  );
}
