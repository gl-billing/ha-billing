"use client";

import { useMemo } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import type { ActivityItem, ClientDetail } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { matterHref } from "@/lib/matter-routes";

type Props = {
  matterCode: string;
  profile: ClientDetail | null;
  tasks: OfficeItem[];
  timeline: ActivityItem[];
    onDismiss: () => void;
};

type CheckItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
  href?: string;
};

export function MatterIntakeChecklist({
  matterCode,
  profile,
  tasks,
  timeline,
    onDismiss
}: Props) {
  const checks = useMemo(() => {
    const hasLedger = Boolean(profile?.masterRow);
    const hasTasks = tasks.length > 0;
    const letterSent = timeline.some(
      (item) =>
        item.kind === "billing" &&
        (item.title.toLowerCase().includes("engagement") || item.subtitle?.toLowerCase().includes("engagement"))
    );
    const soaOrDoc = timeline.some((item) => item.kind === "soa" || item.kind === "ar");

    const list: CheckItem[] = [
      {
        id: "ledger",
        label: "Ledger tab created",
        done: hasLedger,
        hint: hasLedger ? "Billing file is ready." : "Create ledger from billing or re-run intake.",
        href: hasLedger ? matterHref(matterCode, "billing") : undefined
      },
      {
        id: "tasks",
        label: "Starter tasks on file",
        done: hasTasks,
        hint: hasTasks ? `${tasks.length} task(s) linked to this matter.` : "Add the first task for this case.",
        href: matterHref(matterCode, "tasks")
      },
      {
        id: "letter",
        label: "Engagement letter sent or drafted",
        done: letterSent || soaOrDoc,
        hint: "Send from Intake step 5 or Documents tab.",
        href: matterHref(matterCode, "documents")
      }
    ];
    return list;
  }, [matterCode, profile, tasks, timeline]);

  const complete = checks.filter((item) => item.done).length;

  return (
    <section className="card matter-intake-checklist no-print">
      <div className="matter-intake-checklist__head">
        <div>
          <p className="section-label !mb-1">New matter checklist</p>
          <p className="text-xs text-muted">
            {complete} of {checks.length} complete — finish setup for {matterCode}
          </p>
        </div>
        <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <ul className="matter-intake-checklist__list">
        {checks.map((item) => (
          <li key={item.id} className={`matter-intake-checklist__item ${item.done ? "matter-intake-checklist__item--done" : ""}`}>
            <span className="matter-intake-checklist__mark" aria-hidden>
              {item.done ? "✓" : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{item.label}</p>
              {item.hint ? <p className="text-xs text-muted">{item.hint}</p> : null}
            </div>
            {!item.done && item.href ? (
              <SameWindowLink href={item.href} className="cross-system-link shrink-0 text-xs">
                Do this →
              </SameWindowLink>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
