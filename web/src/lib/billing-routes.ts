import type { SavedBillingPage } from "@/lib/staff-prefs";
import { correspondenceHref } from "@/lib/tasks-routes";

export type BillingDocTab = "soa" | "ar";
export type BillingLedgerTab = "charge" | "payment";

export type BillingDeepLink = {
  page?: SavedBillingPage;
  clientCode?: string;
  docTab?: BillingDocTab;
  billingTab?: BillingLedgerTab;
};

const BILLING_PAGES: SavedBillingPage[] = [
  "home",
  "billing",
  "clients",
  "walkIns",
  "spotBilling",
  "notarizations",
  "fieldDispatch",
  "newClient",
  "documents",
  "history",
  "reports",
  "firmFinances",
  "staffSalary"
];

export function parseBillingDeepLink(search: string | URLSearchParams): BillingDeepLink | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const pageRaw = params.get("page")?.trim();
  const clientCode = params.get("client")?.trim().toUpperCase() || undefined;
  const docRaw = params.get("doc")?.trim().toLowerCase();
  const tabRaw = params.get("tab")?.trim().toLowerCase();

  if (!pageRaw && !clientCode && !docRaw && !tabRaw) return null;

  const link: BillingDeepLink = {};
  if (pageRaw && BILLING_PAGES.includes(pageRaw as SavedBillingPage)) {
    link.page = pageRaw as SavedBillingPage;
  }
  if (clientCode) link.clientCode = clientCode;
  if (docRaw === "soa" || docRaw === "ar") link.docTab = docRaw;
  if (tabRaw === "charge" || tabRaw === "payment") link.billingTab = tabRaw;

  return link;
}

export function billingHref(link: BillingDeepLink): string {
  const params = new URLSearchParams();
  if (link.page) params.set("page", link.page);
  if (link.clientCode) params.set("client", link.clientCode.trim().toUpperCase());
  if (link.docTab) params.set("doc", link.docTab);
  if (link.billingTab) params.set("tab", link.billingTab);
  const qs = params.toString();
  return qs ? `/billing?${qs}` : "/billing";
}

export function correspondenceBillingHref(clientCode: string): string {
  return correspondenceHref(clientCode);
}

export function billingTodoHref(
  kind: "overdue" | "pending_ar" | "follow_up",
  clientCode: string
): string {
  switch (kind) {
    case "overdue":
      return billingHref({ page: "documents", clientCode, docTab: "soa" });
    case "pending_ar":
      return billingHref({ page: "documents", clientCode, docTab: "ar" });
    case "follow_up":
      return billingHref({ page: "billing", clientCode });
  }
}
