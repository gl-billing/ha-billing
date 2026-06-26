import type { ClientSummary } from "@/lib/gl-config";
import { filterClientsByQuery } from "@/lib/gl-config";
import { matterHref } from "@/lib/matter-routes";
import { FIRM_MATTERS } from "@/lib/office-tasks/firm-matters";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { searchItems } from "@/lib/office-tasks/sheets/items";
import {
  filterItemsBySmartIntent,
  formatSmartSearchLabel,
  parseSmartSearchQuery,
  type SmartSearchIntent
} from "@/lib/smart-search-query";

export type FirmSearchResult =
  | {
      kind: "client";
      id: string;
      title: string;
      subtitle: string;
      clientCode: string;
      href: string;
    }
  | {
      kind: "task" | "event";
      id: string;
      title: string;
      subtitle: string;
      clientCode: string | null;
      href: string;
      item: OfficeItem;
    };

function clientCodeFromItem(item: OfficeItem): string | null {
  const label = item.clientCase?.trim();
  if (label) {
    const letters = label.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (letters.length >= 2) return letters.slice(0, 3);
  }
  const match = item.id.trim().toUpperCase().match(/^([A-Z]{2,3})-(TASK|EVT)-/);
  return match ? match[1] : null;
}

export function searchFirm(
  query: string,
  clients: ClientSummary[],
  items: OfficeItem[],
  options?: { billingAccess?: boolean; limit?: number; employees?: string[] }
): { results: FirmSearchResult[]; intent: SmartSearchIntent | null; intentLabel: string | null } {
  const q = query.trim();
  if (!q) return { results: [], intent: null, intentLabel: null };

  const limit = options?.limit ?? 24;
  const results: FirmSearchResult[] = [];
  const billingAccess = options?.billingAccess !== false;
  const roster = options?.employees ?? [];
  const intent = parseSmartSearchQuery(q, roster);
  const intentLabel = formatSmartSearchLabel(intent);

  if (!intent.parsed) {
    for (const matter of FIRM_MATTERS) {
      const haystack = `${matter.code} ${matter.title} ${matter.clientCase} ${matter.subtitle}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) continue;
      results.push({
        kind: "client",
        id: `firm:${matter.code}`,
        title: `${matter.code} — ${matter.title}`,
        subtitle: matter.subtitle,
        clientCode: matter.code,
        href: matterHref(matter.code)
      });
    }

    if (billingAccess) {
      for (const client of filterClientsByQuery(clients, q).slice(0, 8)) {
        results.push({
          kind: "client",
          id: `client:${client.code}`,
          title: `${client.code} — ${client.name}`,
          subtitle: client.caseTitle || client.caseNumber || "Billing client",
          clientCode: client.code,
          href: matterHref(client.code),
        });
      }
    }
  }

  const matchedItems = intent.parsed
    ? filterItemsBySmartIntent(items, intent, roster)
    : searchItems(items, q, limit);

  for (const item of matchedItems.slice(0, intent.parsed ? limit : 12)) {
    const code = clientCodeFromItem(item);
    const kind = item.source === "Task" ? "task" : "event";
    results.push({
      kind,
      id: `${kind}:${item.sheetName}:${item.rowNumber}`,
      title: item.clientCase || item.id || kind,
      subtitle: [item.category, item.status, item.assignedTo, item.date].filter(Boolean).join(" · "),
      clientCode: code,
      href: code
        ? matterHref(code, "tasks", {
            case: item.clientCase?.trim() || undefined
          })
        : `/app?tab=${billingAccess ? "all-items" : "today"}&q=${encodeURIComponent(q)}`,
      item
    });
  }

  return {
    results: results.slice(0, limit),
    intent: intent.parsed ? intent : null,
    intentLabel
  };
}
