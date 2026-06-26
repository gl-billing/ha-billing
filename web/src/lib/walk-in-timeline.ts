import { formatPeso, type ActivityItem, type WalkInClient } from "@/lib/gl-config";

function toSortKey(value: string): number {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Walk-in consultation history for a promoted client — shown on matter timeline. */
export function walkInTimelineItems(walkIns: WalkInClient[], clientCode: string): ActivityItem[] {
  const code = clientCode.trim().toUpperCase();
  return walkIns
    .filter((entry) => entry.promotedClientCode.trim().toUpperCase() === code)
    .map((entry) => {
      const billingParts: string[] = [];
      if (entry.billingStatus === "Retainer") {
        billingParts.push("Retainer visit");
      } else if (entry.chargeAmount > 0) {
        billingParts.push(formatPeso(entry.chargeAmount));
        if (entry.paymentAmount > 0) billingParts.push(`paid ${formatPeso(entry.paymentAmount)}`);
        if (entry.billingStatus) billingParts.push(entry.billingStatus);
      }

      return {
        id: `walkin-${entry.walkInId}`,
        date: entry.dateAdded,
        sortKey: toSortKey(entry.dateAdded),
        kind: "billing" as const,
        title: `Walk-in consultation (${entry.walkInId})`,
        subtitle: [entry.name, entry.matter, billingParts.join(" · "), "Promoted to client file"]
          .filter(Boolean)
          .join(" · "),
        status: entry.status
      };
    });
}
