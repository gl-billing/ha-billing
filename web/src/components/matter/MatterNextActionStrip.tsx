"use client";

import { useMemo } from "react";
import type { LedgerEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { ymdToUtcDate } from "@/lib/office-tasks/date-only";
import type { BillingSection } from "@/lib/matter-routes";
import { matterItemAnchorId } from "@/lib/office-tasks/client-matter";

type BillingClientLike = {
  balance: number;
  arPending?: string;
  nextFollowUp?: string;
};

type ActionItem = {
  key: string;
  label: string;
  onClick: () => void;
};

function formatWeekdayShort(ymd: string): string {
  return ymdToUtcDate(ymd).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: "short"
  });
}

function eventShortLabel(item: OfficeItem): string {
  const cat = item.category?.trim() || "Event";
  if (/hearing/i.test(cat)) return "Hearing";
  if (/consultation/i.test(cat)) return "Consultation";
  if (/deadline|filing|submission|court/i.test(cat)) {
    const word = cat.split(/[\s/–-]/)[0]?.trim();
    return word || "Deadline";
  }
  return cat.length > 22 ? `${cat.slice(0, 20)}…` : cat;
}

function findRetainerDue(entries: LedgerEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const haystack = `${entry.category} ${entry.description}`.toLowerCase();
    if (!haystack.includes("retainer")) continue;
    const due = Math.max(0, entry.charge - entry.payment);
    if (due > 0.005) return due;
  }
  return 0;
}

function findUnsentArAmount(entries: LedgerEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.payment > 0.005 && !entry.arSent) return entry.payment;
  }
  return 0;
}

type Props = {
  billingClient: BillingClientLike;
  ledgerEntries: LedgerEntry[];
  pendingEvents: OfficeItem[];
  openTasks: number;
  onBillingSection: (section: BillingSection) => void;
  onScrollToTasks: () => void;
  onJumpToItem: (anchorId: string) => void;
};

export function MatterNextActionStrip({
  billingClient,
  ledgerEntries,
  pendingEvents,
  openTasks,
  onBillingSection,
  onScrollToTasks,
  onJumpToItem
}: Props) {
  const actions = useMemo(() => {
    const items: ActionItem[] = [];

    const retainerDue = findRetainerDue(ledgerEntries);
    if (retainerDue > 0.005) {
      items.push({
        key: "retainer",
        label: `Post ${formatPeso(retainerDue)} retainer`,
        onClick: () => onBillingSection("add")
      });
    }

    const unsentAr = findUnsentArAmount(ledgerEntries);
    if (billingClient.arPending === "Yes" || unsentAr > 0.005) {
      items.push({
        key: "ar",
        label: unsentAr > 0.005 ? `Send AR · ${formatPeso(unsentAr)}` : "Send AR",
        onClick: () => onBillingSection("documents")
      });
    }

    if (billingClient.balance > 0.005) {
      items.push({
        key: "soa",
        label: `Send SOA · ${formatPeso(billingClient.balance)}`,
        onClick: () => onBillingSection("documents")
      });
    }

    const nextEvent = pendingEvents.find((item) => item.eventDate || item.date);
    if (nextEvent) {
      const when = nextEvent.eventDate || nextEvent.date || "";
      const weekday = when ? formatWeekdayShort(when) : "";
      items.push({
        key: `event-${nextEvent.rowNumber}`,
        label: weekday ? `${eventShortLabel(nextEvent)} ${weekday}` : eventShortLabel(nextEvent),
        onClick: () => onJumpToItem(matterItemAnchorId(nextEvent))
      });
    }

    const followUp = billingClient.nextFollowUp?.trim();
    if (followUp && /^\d{4}-\d{2}-\d{2}$/.test(followUp)) {
      items.push({
        key: "follow-up",
        label: `Follow-up ${formatWeekdayShort(followUp)}`,
        onClick: () => onBillingSection("advanced")
      });
    }

    if (openTasks > 0 && items.length < 4) {
      items.push({
        key: "tasks",
        label: openTasks === 1 ? "1 open task" : `${openTasks} open tasks`,
        onClick: onScrollToTasks
      });
    }

    return items.slice(0, 4);
  }, [
    billingClient.arPending,
    billingClient.balance,
    billingClient.nextFollowUp,
    ledgerEntries,
    onBillingSection,
    onJumpToItem,
    onScrollToTasks,
    openTasks,
    pendingEvents
  ]);

  if (!actions.length) return null;

  return (
    <nav className="matter-next-actions no-print" aria-label="Suggested next actions">
      <span className="matter-next-actions__label">Next</span>
      <div className="matter-next-actions__links">
        {actions.map((action, index) => (
          <span key={action.key} className="matter-next-actions__item">
            {index > 0 ? <span className="matter-next-actions__sep" aria-hidden>·</span> : null}
            <button type="button" className="matter-next-actions__link" onClick={action.onClick}>
              {action.label}
            </button>
          </span>
        ))}
      </div>
    </nav>
  );
}
