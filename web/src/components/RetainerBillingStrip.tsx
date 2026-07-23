"use client";

import { formatPeso, type HomeDashboard } from "@/lib/gl-config";

type Props = {
  upcoming: NonNullable<HomeDashboard["upcomingRetainers"]>;
  monthSummary?: HomeDashboard["retainerMonthSummary"] | null;
  onOpenClient: (code: string) => void;
};

export function RetainerBillingStrip({ upcoming, monthSummary, onOpenClient }: Props) {
  if (!upcoming.length && !monthSummary?.retainerCount) return null;

  return (
    <section className="retainer-billing-strip card" aria-label="Retainer billing">
      <div className="retainer-billing-strip__head">
        <div>
          <p className="section-label !mb-0">Retainers</p>
          <h3 className="font-display text-lg text-ink">Upcoming monthly billings</h3>
        </div>
        {monthSummary ? (
          <p className="text-sm text-muted">
            {monthSummary.retainerCount ?? 0} active
            {typeof monthSummary.dueCount === "number" ? ` · ${monthSummary.dueCount} due soon` : ""}
            {typeof monthSummary.missingEmailCount === "number" && monthSummary.missingEmailCount > 0
              ? ` · ${monthSummary.missingEmailCount} missing email`
              : ""}
          </p>
        ) : null}
      </div>
      {upcoming.length ? (
        <ul className="retainer-billing-strip__list mt-3">
          {upcoming.slice(0, 8).map((row) => (
            <li key={row.clientCode}>
              <button
                type="button"
                className="retainer-billing-strip__row"
                onClick={() => onOpenClient(row.clientCode)}
              >
                <span className="retainer-billing-strip__client">
                  <strong>{row.clientCode}</strong> · {row.clientName}
                  {row.directoryLabel ? ` — ${row.directoryLabel}` : ""}
                </span>
                <span className="retainer-billing-strip__meta">
                  {row.dueDate} · {row.fee > 0 ? formatPeso(row.fee) : "Fee unset"}
                  {row.emailOk === false ? " · no email" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No retainer billings due in the next window.</p>
      )}
    </section>
  );
}
