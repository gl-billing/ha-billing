import { canEditDeskBilling, isSecretaryNavUser } from "@/lib/app-access";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
import type { SavedBillingPage, SavedTasksTab } from "@/lib/staff-prefs";

export type NavUserProfile = "full" | "tasks-only" | "secretary";

export const TASKS_TAB_LABELS: Record<SavedTasksTab, string> = {
  today: "Today",
  calendar: "Calendar",
  week: "Week view",
  team: "Staff load",
  history: "Archive",
  "add-task": "New task",
  "add-event": "New event",
  "all-items": "Search",
  correspondence: "Letters",
  tools: "Admin tools"
};

export const TASKS_TAB_DESCRIPTIONS: Record<SavedTasksTab, string> = {
  today: "Your overdue, due-today, and in-progress tasks, hearings, events, and filings.",
  calendar: "Month view of hearings, deadlines, meetings, and office events.",
  week: "Weekly planner — see the firm’s schedule day by day.",
  team: "Workload by staff — who has what open across the office.",
  history: "Completed and past tasks and events across dates.",
  "add-task": "Create a new task or to-do and assign it to a client matter.",
  "add-event": "Schedule hearings, meetings, court filings, and submission deadlines.",
  "all-items": "Search and browse every open task, hearing, and event.",
  correspondence: "Draft demand letters, proposals, replies, and other firm correspondence on letterhead.",
  tools: "Diagnostics, imports, BIR tracker, and other admin tools."
};

export type BillingNavTabGroup = "daily" | "clients" | "overview" | "admin";
export type TasksNavTabGroup = "daily" | "actions" | "schedule" | "browse" | "oversight" | "admin";
export type NavTabGroup = BillingNavTabGroup | TasksNavTabGroup;

export const NAV_TAB_GROUP_LABELS: Record<NavTabGroup, string> = {
  daily: "Today",
  actions: "New",
  clients: "Clients",
  overview: "Reports",
  admin: "Admin",
  schedule: "Calendar",
  browse: "Search",
  oversight: "Team"
};

/** @deprecated Use NAV_TAB_GROUP_LABELS */
export const BILLING_NAV_GROUP_LABELS = NAV_TAB_GROUP_LABELS;

export type NavTabDef<T extends string = string> = {
  id: T;
  label: string;
  description: string;
  adminOnly?: boolean;
  group?: NavTabGroup;
};

/** Tasks nav — full staff tab bar */
export const TASKS_NAV_TABS: NavTabDef<SavedTasksTab>[] = [
  { id: "today", label: TASKS_TAB_LABELS.today, description: TASKS_TAB_DESCRIPTIONS.today, group: "daily" },
  {
    id: "add-task",
    label: TASKS_TAB_LABELS["add-task"],
    description: TASKS_TAB_DESCRIPTIONS["add-task"],
    group: "actions"
  },
  {
    id: "add-event",
    label: TASKS_TAB_LABELS["add-event"],
    description: TASKS_TAB_DESCRIPTIONS["add-event"],
    group: "actions"
  },
  {
    id: "calendar",
    label: TASKS_TAB_LABELS.calendar,
    description: TASKS_TAB_DESCRIPTIONS.calendar,
    group: "schedule"
  },
  {
    id: "all-items",
    label: TASKS_TAB_LABELS["all-items"],
    description: TASKS_TAB_DESCRIPTIONS["all-items"],
    group: "browse"
  },
  {
    id: "correspondence",
    label: TASKS_TAB_LABELS.correspondence,
    description: TASKS_TAB_DESCRIPTIONS.correspondence,
    group: "actions"
  },
  { id: "week", label: TASKS_TAB_LABELS.week, description: TASKS_TAB_DESCRIPTIONS.week, group: "schedule" },
  { id: "team", label: TASKS_TAB_LABELS.team, description: TASKS_TAB_DESCRIPTIONS.team, group: "oversight" },
  { id: "history", label: TASKS_TAB_LABELS.history, description: TASKS_TAB_DESCRIPTIONS.history, group: "oversight" },
  {
    id: "tools",
    label: TASKS_TAB_LABELS.tools,
    description: TASKS_TAB_DESCRIPTIONS.tools,
    group: "admin"
  }
];

/** Full staff — daily use first, then schedule, search, oversight, admin */
const FULL_TASKS_NAV_TAB_IDS: SavedTasksTab[] = [
  "today",
  "add-task",
  "add-event",
  "calendar",
  "week",
  "all-items",
  "correspondence",
  "team",
  "history",
  "tools"
];

export const BILLING_PAGE_LABELS: Record<SavedBillingPage, string> = {
  home: "Summary",
  billing: "Entries",
  clients: "Clients",
  walkIns: "Walk-ins",
  spotBilling: "One-off fees",
  notarizations: "Notarial",
  fieldDispatch: "Field visits",
  newClient: "New client",
  documents: "Statements",
  history: "Posted log",
  reports: "Reports",
  firmFinances: "Firm books",
  staffSalary: "Payroll"
};

export const BILLING_PAGE_DESCRIPTIONS: Record<SavedBillingPage, string> = {
  home: "Firm-wide overview — balances, alerts, birthdays, and quick links.",
  billing: "Post charges and payments to client ledgers.",
  clients: "Browse client matters and open a client’s billing file.",
  walkIns: "Same-day walk-in clients, quick intake, and same-day fees.",
  spotBilling: "Occasional payers with one or two transactions — no Master List client file.",
  notarizations: "Notarial records, acknowledgments, and notarial fees.",
  fieldDispatch: "Assign and track field staff visits and dispatches.",
  newClient: "New client intake — open a matter and set up billing.",
  documents: "Generate statements of account and accounts receivable.",
  history: "Posted ledger entries and billing history across clients.",
  reports: "Billing reports, collections, and exportable summaries.",
  firmFinances: "Firm-level financial overview and admin finance tools.",
  staffSalary: "Payroll runs, cash advances, and staff compensation."
};

/** Full catalog — labels for every billing page (nav uses subsets below). */
export const BILLING_NAV_TABS: NavTabDef<SavedBillingPage>[] = [
  {
    id: "billing",
    label: BILLING_PAGE_LABELS.billing,
    description: BILLING_PAGE_DESCRIPTIONS.billing,
    group: "daily"
  },
  {
    id: "walkIns",
    label: BILLING_PAGE_LABELS.walkIns,
    description: BILLING_PAGE_DESCRIPTIONS.walkIns,
    group: "daily"
  },
  {
    id: "spotBilling",
    label: BILLING_PAGE_LABELS.spotBilling,
    description: BILLING_PAGE_DESCRIPTIONS.spotBilling,
    group: "daily"
  },
  {
    id: "notarizations",
    label: BILLING_PAGE_LABELS.notarizations,
    description: BILLING_PAGE_DESCRIPTIONS.notarizations,
    group: "daily"
  },
  {
    id: "clients",
    label: BILLING_PAGE_LABELS.clients,
    description: BILLING_PAGE_DESCRIPTIONS.clients,
    group: "clients"
  },
  {
    id: "newClient",
    label: BILLING_PAGE_LABELS.newClient,
    description: BILLING_PAGE_DESCRIPTIONS.newClient,
    group: "clients"
  },
  {
    id: "documents",
    label: BILLING_PAGE_LABELS.documents,
    description: BILLING_PAGE_DESCRIPTIONS.documents,
    group: "clients"
  },
  {
    id: "home",
    label: BILLING_PAGE_LABELS.home,
    description: BILLING_PAGE_DESCRIPTIONS.home,
    group: "overview"
  },
  {
    id: "history",
    label: BILLING_PAGE_LABELS.history,
    description: BILLING_PAGE_DESCRIPTIONS.history,
    group: "overview"
  },
  {
    id: "reports",
    label: BILLING_PAGE_LABELS.reports,
    description: BILLING_PAGE_DESCRIPTIONS.reports,
    group: "overview"
  },
  {
    id: "fieldDispatch",
    label: BILLING_PAGE_LABELS.fieldDispatch,
    description: BILLING_PAGE_DESCRIPTIONS.fieldDispatch,
    adminOnly: true,
    group: "admin"
  },
  {
    id: "staffSalary",
    label: BILLING_PAGE_LABELS.staffSalary,
    description: BILLING_PAGE_DESCRIPTIONS.staffSalary,
    adminOnly: true,
    group: "admin"
  },
  {
    id: "firmFinances",
    label: BILLING_PAGE_LABELS.firmFinances,
    description: BILLING_PAGE_DESCRIPTIONS.firmFinances,
    adminOnly: true,
    group: "admin"
  }
];

const FULL_BILLING_NAV_TAB_IDS: SavedBillingPage[] = [
  "billing",
  "walkIns",
  "clients",
  "documents",
  "spotBilling",
  "notarizations",
  "newClient",
  "home",
  "history",
  "reports"
];

const ADMIN_BILLING_NAV_TAB_IDS: SavedBillingPage[] = ["staffSalary", "firmFinances"];

export function isAdminBillingPage(page: SavedBillingPage): boolean {
  return BILLING_NAV_TABS.some((tab) => tab.id === page && tab.adminOnly);
}

/** Desk staff — full billing except admin-only pages and firm reports. */
const SECRETARY_BILLING_NAV_TAB_IDS: SavedBillingPage[] = [
  "billing",
  "walkIns",
  "clients",
  "notarizations",
  "spotBilling",
  "documents",
  "newClient",
  "home",
  "history"
];

/** Desk editors — walk-ins, spot billing, and notarizations (Andrea / info@). */
export const DESK_BILLING_EDIT_PAGES: SavedBillingPage[] = ["walkIns", "spotBilling", "notarizations"];

const TASKS_ONLY_NAV_TAB_IDS: SavedTasksTab[] = ["today", "add-task", "add-event", "calendar"];

/** Secretary — daily work, calendar, correspondence, and team views (no admin tools). */
const SECRETARY_TASKS_NAV_TAB_IDS: SavedTasksTab[] = [
  "today",
  "add-task",
  "add-event",
  "calendar",
  "week",
  "all-items",
  "correspondence",
  "team",
  "history"
];

export function resolveNavUserProfile(options: {
  email?: string | null;
  billingAccess: boolean;
  secretaryNav?: boolean;
}): NavUserProfile {
  if (!options.billingAccess) return "tasks-only";
  if (isFirmOwnerEmail(options.email)) return "full";
  if (options.secretaryNav ?? isSecretaryNavUser(options.email)) return "secretary";
  return "full";
}

function pickTasksNavTabs(ids: SavedTasksTab[]): typeof TASKS_NAV_TABS {
  return ids.map((id) => {
    const tab = TASKS_NAV_TABS.find((entry) => entry.id === id);
    return tab ?? { id, label: TASKS_TAB_LABELS[id], description: TASKS_TAB_DESCRIPTIONS[id] };
  });
}

function pickBillingNavTabs(ids: SavedBillingPage[], isAdmin: boolean): typeof BILLING_NAV_TABS {
  return ids
    .map((id) => BILLING_NAV_TABS.find((tab) => tab.id === id))
    .filter((tab): tab is (typeof BILLING_NAV_TABS)[number] => Boolean(tab && (!tab.adminOnly || isAdmin)));
}

export function billingNavTabsForUser(
  isAdmin: boolean,
  profile: NavUserProfile = "full",
  canManageTeamRoster = false
): typeof BILLING_NAV_TABS {
  if (profile === "secretary") {
    return pickBillingNavTabs(SECRETARY_BILLING_NAV_TAB_IDS, isAdmin);
  }
  const ids = isAdmin
    ? [...FULL_BILLING_NAV_TAB_IDS, ...ADMIN_BILLING_NAV_TAB_IDS]
    : canManageTeamRoster
      ? [...FULL_BILLING_NAV_TAB_IDS, "staffSalary"]
      : FULL_BILLING_NAV_TAB_IDS;
  return pickBillingNavTabs(ids, isAdmin || canManageTeamRoster);
}

/** Tasks-only staff (e.g. Jas) — daily board, calendar, and quick add (no billing browse tabs). */
export function tasksNavTabsForUser(
  billingAccess: boolean,
  profile: NavUserProfile = "full"
): typeof TASKS_NAV_TABS {
  if (profile === "tasks-only" || !billingAccess) {
    return pickTasksNavTabs(TASKS_ONLY_NAV_TAB_IDS);
  }
  if (profile === "secretary") {
    return pickTasksNavTabs(SECRETARY_TASKS_NAV_TAB_IDS);
  }
  return pickTasksNavTabs(FULL_TASKS_NAV_TAB_IDS);
}

export function isAllowedTasksTab(
  tab: SavedTasksTab,
  billingAccess: boolean,
  profile: NavUserProfile = "full"
): boolean {
  if (tab === "correspondence" && !billingAccess) return false;
  const resolved = profile === "full" && !billingAccess ? "tasks-only" : profile;
  if (resolved === "full" && billingAccess) return true;
  if (resolved === "tasks-only") return TASKS_ONLY_NAV_TAB_IDS.includes(tab);
  if (resolved === "secretary") return SECRETARY_TASKS_NAV_TAB_IDS.includes(tab);
  return false;
}

export function isAllowedBillingPage(
  page: SavedBillingPage,
  isAdmin: boolean,
  profile: NavUserProfile = "full",
  email?: string | null,
  canManageTeamRoster = false
): boolean {
  if (page === "staffSalary" && canManageTeamRoster) return true;
  if (isAdminBillingPage(page) && !isAdmin) return false;
  if (email && canEditDeskBilling(email) && DESK_BILLING_EDIT_PAGES.includes(page)) return true;
  if (profile === "secretary") return SECRETARY_BILLING_NAV_TAB_IDS.includes(page);
  return true;
}
