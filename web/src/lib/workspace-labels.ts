import { canEditDeskBilling, isSecretaryNavUser } from "@/lib/app-access";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
import type { SavedBillingPage, SavedTasksTab } from "@/lib/staff-prefs";

export type NavUserProfile = "full" | "tasks-only" | "secretary";

export const TASKS_TAB_LABELS: Record<SavedTasksTab, string> = {
  today: "My work",
  calendar: "Calendar",
  week: "Week plan",
  team: "Team work",
  history: "Past tasks",
  "add-task": "Add task",
  "add-event": "Add event",
  "all-items": "Search all",
  correspondence: "Letters",
  tools: "Tools"
};

export const TASKS_TAB_DESCRIPTIONS: Record<SavedTasksTab, string> = {
  today:
    "Your daily list — overdue items first, then due today, in progress, and finished today. Tap a card to open details.",
  calendar:
    "Month view of hearings, filing deadlines, meetings, and tasks. Tap a date to see what is scheduled.",
  week: "See the next seven days at a glance — useful when planning the week ahead.",
  team: "See who on the team has open work and how much each person has on their plate.",
  history: "Look up finished or past tasks and events when you need to check what was done.",
  "add-task":
    "Create a to-do (drafting, follow-up, prep). Enter the client matter, assignee, due date, and what needs to be done.",
  "add-event":
    "Book a hearing, meeting, or filing deadline. Enter the date, client matter, location or court, and any notes.",
  "all-items": "Search every open task, hearing, and event by keyword, client, or staff member.",
  correspondence:
    "Write demand letters, proposals, replies, and other letters on firm letterhead — pick a template and fill in the details.",
  tools: "Refresh data, sync Google Calendar, print lists, and other admin settings."
};

export type BillingNavTabGroup = "daily" | "clients" | "overview" | "admin";
export type TasksNavTabGroup = "daily" | "actions" | "schedule" | "browse" | "oversight" | "admin";
export type NavTabGroup = BillingNavTabGroup | TasksNavTabGroup;

export const NAV_TAB_GROUP_LABELS: Record<NavTabGroup, string> = {
  daily: "Every day",
  actions: "Add new",
  clients: "Clients",
  overview: "Overview",
  admin: "Admin only",
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
  home: "Overview",
  billing: "Charges & pay",
  clients: "Find client",
  walkIns: "Walk-ins",
  spotBilling: "One-time fees",
  notarizations: "Notary log",
  fieldDispatch: "Field visits",
  newClient: "New client",
  documents: "SOA & AR",
  history: "Activity log",
  reports: "Reports",
  firmFinances: "Firm income",
  staffSalary: "Payroll"
};

export const BILLING_PAGE_DESCRIPTIONS: Record<SavedBillingPage, string> = {
  home:
    "Firm snapshot — total balances, who owes money, client birthdays, and quick links to common tasks.",
  billing:
    "Record a fee or payment for a regular client. Pick the client, then enter date, amount, category, and a short description.",
  clients:
    "Look up a client by name or code and open their billing file, ledger, tasks, and documents.",
  walkIns:
    "Log someone who walked in today. Enter their name, visit type, amount charged, and payment if they paid now.",
  spotBilling:
    "For people who pay once or twice only — not on the main client list. Enter name, fee, and payment details.",
  notarizations:
    "Record a notarized document — enter book/page numbers, document type, fee, and how they paid.",
  fieldDispatch:
    "Track out-of-town field trips — enter advance money, service fee, and bill the client when staff returns.",
  newClient:
    "Start a new retained client — enter name, contact details, case info, and choose the agreement to send.",
  documents:
    "Print or email a Statement of Account (SOA) or payment receipt (AR). Post charges and payments first on Charges & payments.",
  history:
    "See everything posted — charges, payments, SOAs, receipts, and record changes — across all clients.",
  reports:
    "View overdue balances, monthly collections, download exports, and run admin maintenance tools.",
  firmFinances:
    "Admin — review firm income and split it into expense, savings, travel, and emergency buckets each month.",
  staffSalary:
    "Admin — run semi-monthly payroll, staff allowances, and cash advances."
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

const ROSTER_ADMIN_BILLING_NAV_TAB_IDS: SavedBillingPage[] = [...FULL_BILLING_NAV_TAB_IDS, "staffSalary"];

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
      ? ROSTER_ADMIN_BILLING_NAV_TAB_IDS
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
