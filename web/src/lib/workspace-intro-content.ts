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
  today: "Your daily board — overdue first, then waiting, due today, and this week.",
  "add-task": "Office or field work assigned to someone with a due date.",
  "add-event": "Hearings, consultations, meetings, and deadlines on the calendar.",
  correspondence: "Draft demand letters, proposals, replies, and other firm correspondence.",
  calendar: "Month view of hearings, deadlines, and dated work.",
  week: "Seven-day planner for coordinating the firm’s schedule.",
  "all-items": "Search and browse every open task, hearing, and event.",
  team: "Who has what open — workload by staff member.",
  history: "Recently completed tasks and events for reference.",
  tools: "Refresh sheets, sync Google Calendar, and other firm tools."
};

const BILLING_TAB_DESCRIPTIONS: Record<string, string> = {
  billing: "Post charges and payments to client ledgers — daily money in and out.",
  walkIns: "Same-day visitors and consultation fees; promote to a client file when retained.",
  spotBilling: "Occasional payers with one or two transactions — no full client file.",
  notarizations: "Notarial records, acknowledgments, and notarial fees.",
  newClient: "Full retained-matter intake — code, conflict check, and billing setup.",
  clients: "Open any client’s billing file from the directory.",
  documents: "Generate statements of account and acknowledgment receipts.",
  history: "Posted ledger entries and billing history across clients.",
  home: "Firm-wide balances, batch SOA, and collections overview.",
  reports: "Exports and billing reports for partners and admin.",
  fieldDispatch: "Assign and track field staff visits.",
  staffSalary: "Payroll runs, cash advances, and staff compensation.",
  firmFinances: "Firm-level financial overview and admin finance tools."
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
      "Shared calendar and assignments for the firm — track hearings, deadlines, and day-to-day work. Client billing is in Accounts.",
    tip: "Tap a tab name below to open that section.",
    instructionsAnchor: "tasks-tabs",
    items: buildItemsFromTabs(tabs, TASKS_TAB_DESCRIPTIONS)
  };
}

export function getBillingIntroContent(tabs: NavTabDef[]): WorkspaceIntroContent {
  return {
    title: "Accounts",
    lede:
      "Client files, money in and out, statements, and firm reports. Use Entries for routine charges and payments.",
    tip: "Tap a tab name below to open that section.",
    instructionsAnchor: "billing-tabs",
    items: buildItemsFromTabs(tabs, BILLING_TAB_DESCRIPTIONS)
  };
}
