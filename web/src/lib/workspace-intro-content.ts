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

const TASKS_TAB_DESCRIPTIONS: Record<string, string> = {
  today: "Your daily list — overdue first, then due today and in progress.",
  "add-task": "Create a to-do: pick client, assignee, due date, and describe the work.",
  "add-event": "Book a hearing, meeting, or filing deadline with date, time, and client matter.",
  correspondence: "Draft demand letters, proposals, replies, and other letters on firm letterhead.",
  calendar: "Month view — tap a date to see hearings, deadlines, and tasks.",
  week: "Seven-day planner for coordinating the week ahead.",
  "all-items": "Search every open task, hearing, and event.",
  team: "See each staff member's open work and how busy everyone is.",
  history: "Finished and past tasks and events for reference.",
  tools: "Refresh sheets, sync Google Calendar, print lists, and administration.",
  liaison:
    "Confidential assignments from admin — visible only on this tab for the liaison officer and admin.",
  presence: "Confidential attendance register for firm management."
};

const BILLING_TAB_DESCRIPTIONS: Record<string, string> = {
  billing:
    "Record fees and payments for regular clients — date, amount, category, description.",
  walkIns: "Walk-in log — name, visit type, fee, and payment.",
  spotBilling: "One-time payers not on the main client list — name, fee, and payment.",
  notarizations: "Notary register — book/page numbers, document type, fee, payment method.",
  newClient: "Full intake for a retained client — contact info, case details, agreement.",
  clients: "Find a client by name or code and open their billing file.",
  documents: "Print or email SOA statements and payment receipts.",
  history: "Office-wide log of posted charges, payments, SOAs, and changes.",
  home: "Firm overview — balances, collections, birthdays, and links.",
  reports: "Overdue balances, monthly collections, CSV exports, and administration.",
  fieldDispatch: "Track field trips — advance, service fee, and client billing.",
  staffSalary: "Semi-monthly payroll, allowances, and cash advances.",
  firmFinances: "Firm income split into expense, savings, and other buckets."
};

function buildItemsFromTabs(tabs: NavTabDef[], descriptions: Record<string, string>): WorkspaceIntroItem[] {
  return tabs.map((tab) => ({
    tabId: tab.id,
    label: tab.label,
    description: descriptions[tab.id] ?? tab.description
  }));
}

export function getTasksIntroContent(tabs: NavTabDef[]): WorkspaceIntroContent {
  return {
    title: "Schedule",
    lede:
      "Track hearings, deadlines, and day-to-day work for the firm. Use My work for today's list; add tasks and events when something new comes in.",
    tip: "Hover a tab name for a short guide, or tap the (i) icon on each page for what to enter.",
    instructionsAnchor: "tasks-tabs",
    items: buildItemsFromTabs(tabs, TASKS_TAB_DESCRIPTIONS)
  };
}

export function getBillingIntroContent(tabs: NavTabDef[]): WorkspaceIntroContent {
  return {
    title: "Accounts",
    lede:
      "Client billing, money in and out, statements, and firm reports. Use Record fees & payments for regular clients; Log walk-ins and One-time payment for everyone else.",
    tip: "Hover a tab name for a short guide, or tap the (i) icon on each page for what to enter.",
    instructionsAnchor: "billing-tabs",
    items: buildItemsFromTabs(tabs, BILLING_TAB_DESCRIPTIONS)
  };
}
