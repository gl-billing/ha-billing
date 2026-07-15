import type { NavTabDef } from "@/lib/workspace-labels";

export type WorkspaceIntroKind = "tasks" | "billing";

export type WorkspaceIntroItem = {
  tabId: string;
  label: string;
  description: string;
};

export type WorkspaceIntroContent = {
  title: string;
  lede: string;
  tip: string;
  instructionsAnchor: string;
  items: WorkspaceIntroItem[];
};

function buildItemsFromTabs(tabs: NavTabDef[]): WorkspaceIntroItem[] {
  return tabs.map((tab) => ({
    tabId: tab.id,
    label: tab.label,
    description: tab.description
  }));
}

export function getTasksIntroContent(tabs: NavTabDef[]): WorkspaceIntroContent {
  return {
    title: "Schedule",
    lede:
      "Hearings, deadlines, and assigned work for the firm. Use My work for today’s list; open Calendar for the month. Confidential — authorized staff only.",
    tip: "",
    instructionsAnchor: "tasks-tabs",
    items: buildItemsFromTabs(tabs)
  };
}

export function getBillingIntroContent(tabs: NavTabDef[]): WorkspaceIntroContent {
  return {
    title: "Accounts",
    lede:
      "Client billing, receipts, and firm records. Post fees and payments on the ledger; issue statements from Documents. Confidential — authorized staff only.",
    tip: "",
    instructionsAnchor: "billing-tabs",
    items: buildItemsFromTabs(tabs)
  };
}
