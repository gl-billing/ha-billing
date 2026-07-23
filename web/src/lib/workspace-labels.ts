import { canEditDeskBilling, isAssociateLawyerEmail, isSecretaryNavUser } from "@/lib/app-access";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
import type { SavedBillingPage, SavedTasksTab } from "@/lib/staff-prefs";

export type NavUserProfile = "full" | "tasks-only" | "secretary" | "associate";

export const TASKS_TAB_LABELS: Record<SavedTasksTab, string> = {
  "desk-checklist": "Checklist",
  today: "My work",
  calendar: "Calendar",
  week: "Week planner",
  team: "Staff load",
  history: "Completed",
  "add-task": "New task",
  "add-event": "New hearing & filing",
  "all-items": "Find item",
  correspondence: "Correspondence",
  filing: "Filing",
  tools: "Administration",
  liaison: "Liaison",
  presence: "Staff attendance"
};

export const TASKS_TAB_DESCRIPTIONS: Record<SavedTasksTab, string> = {
  "desk-checklist":
    "Simple checkbox list — overdue, due today, and due this week.",
  today:
    "Assigned work for today — overdue first, then due today, in progress, and finished today.",
  calendar:
    "Month calendar of hearings, filing deadlines, meetings, and tasks. Select a date to open the docket.",
  week: "Work due over the next seven days.",
  team: "Each staff member’s open work, overdue items, and capacity.",
  history: "Finished or past tasks and events.",
  "add-task":
    "Create a task (drafting, follow-up, prep). Enter the matter, assignee, due date, and particulars.",
  "add-event":
    "Enter a hearing, meeting, or filing deadline with date, matter, venue or court, and notes.",
  "all-items": "Search open tasks, hearings, and events by keyword, client, or staff member.",
  correspondence:
    "Draft demand letters, proposals, replies, and other letters on firm letterhead.",
  filing: "E-filing and registered mail / courier / personal service queues for submitted pleadings.",
  tools: "Update data, sync Google Calendar, print lists, and other administration.",
  liaison:
    "Confidential assignments from admin to the liaison officer — not visible on other schedule tabs.",
  presence:
    "Confidential attendance register — who is signed in to Office, and last activity (firm management only)."
};

export type BillingNavTabGroup = "daily" | "clients" | "overview" | "admin";
export type TasksNavTabGroup = "daily" | "actions" | "schedule" | "browse" | "oversight" | "admin";
export type NavTabGroup = BillingNavTabGroup | TasksNavTabGroup;

export const NAV_TAB_GROUP_LABELS: Record<NavTabGroup, string> = {
  daily: "Daily",
  actions: "New",
  clients: "Clients",
  overview: "Overview",
  admin: "Administration",
  schedule: "Calendar",
  browse: "Search",
  oversight: "Staff"
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

/** Desk checklist — available to all profiles (also under Clio Checklist). */
const DESK_CHECKLIST_NAV_TAB: NavTabDef<"desk-checklist"> = {
  id: "desk-checklist",
  label: TASKS_TAB_LABELS["desk-checklist"],
  description: TASKS_TAB_DESCRIPTIONS["desk-checklist"],
  group: "daily"
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
  {
    id: "filing",
    label: TASKS_TAB_LABELS.filing,
    description: TASKS_TAB_DESCRIPTIONS.filing,
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
  },
  {
    id: "liaison",
    label: TASKS_TAB_LABELS.liaison,
    description: TASKS_TAB_DESCRIPTIONS.liaison,
    group: "oversight"
  },
  {
    id: "presence",
    label: TASKS_TAB_LABELS.presence,
    description: TASKS_TAB_DESCRIPTIONS.presence,
    group: "admin"
  }
];

/** Full staff — daily use first, then schedule, search, oversight, admin */
const FULL_TASKS_NAV_TAB_IDS: SavedTasksTab[] = [
  "desk-checklist",
  "today",
  "add-task",
  "add-event",
  "filing",
  "calendar",
  "week",
  "all-items",
  "correspondence",
  "team",
  "history",
  "tools"
];

export const BILLING_PAGE_LABELS: Record<SavedBillingPage, string> = {
  home: "Firm overview",
  billing: "Record fees & payments",
  clients: "Client directory",
  walkIns: "Walk-in log",
  spotBilling: "One-time payment",
  notarizations: "Notary register",
  fieldDispatch: "Field dispatch",
  newClient: "New client intake",
  documents: "Statements & receipts",
  history: "Billing activity",
  reports: "Firm reports",
  firmFinances: "Firm income",
  staffSalary: "Staff payroll"
};

export const BILLING_PAGE_DESCRIPTIONS: Record<SavedBillingPage, string> = {
  home:
    "Firm balances, collections overview, client birthdays, and links to common accounts work.",
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
    "Print or email a Statement of Account (SOA) or payment receipt (AR). Post charges and payments first on Record fees & payments.",
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

const ADMIN_BILLING_NAV_TAB_IDS: SavedBillingPage[] = ["staffSalary", "firmFinances", "fieldDispatch"];

const ROSTER_ADMIN_BILLING_NAV_TAB_IDS: SavedBillingPage[] = [...FULL_BILLING_NAV_TAB_IDS, "staffSalary"];

export function isAdminBillingPage(page: SavedBillingPage): boolean {
  return BILLING_NAV_TABS.some((tab) => tab.id === page && tab.adminOnly);
}

/** Secretaries (Shiela, Hiedee) — desk billing without reports or admin pages. */
const SECRETARY_BILLING_NAV_TAB_IDS: SavedBillingPage[] = [
  "billing",
  "walkIns",
  "clients",
  "documents",
  "spotBilling",
  "notarizations",
  "newClient",
  "home"
];

/** Desk editors — walk-ins, spot billing, and notarizations. */
export const DESK_BILLING_EDIT_PAGES: SavedBillingPage[] = ["walkIns", "spotBilling", "notarizations"];

const TASKS_ONLY_NAV_TAB_IDS: SavedTasksTab[] = [
  "desk-checklist",
  "today",
  "add-task",
  "add-event",
  "filing",
  "calendar"
];

/** Associate lawyers — counsel desk essentials (no billing / team oversight). */
const ASSOCIATE_TASKS_NAV_TAB_IDS: SavedTasksTab[] = [
  "desk-checklist",
  "today",
  "add-task",
  "add-event",
  "calendar",
  "week",
  "filing",
  "correspondence",
  "all-items"
];

/** Secretaries — schedule + correspondence + search (no team oversight or admin tools). */
const SECRETARY_TASKS_NAV_TAB_IDS: SavedTasksTab[] = [
  "desk-checklist",
  "today",
  "add-task",
  "add-event",
  "filing",
  "calendar",
  "week",
  "all-items",
  "correspondence"
];

export function resolveNavUserProfile(options: {
  email?: string | null;
  billingAccess: boolean;
  secretaryNav?: boolean;
}): NavUserProfile {
  if (!options.billingAccess) {
    if (options.email && isAssociateLawyerEmail(options.email)) return "associate";
    return "tasks-only";
  }
  if (isFirmOwnerEmail(options.email)) return "full";
  if (options.secretaryNav ?? isSecretaryNavUser(options.email)) return "secretary";
  return "full";
}

function pickTasksNavTabs(ids: SavedTasksTab[]): typeof TASKS_NAV_TABS {
  return ids.map((id) => {
    if (id === "desk-checklist") return DESK_CHECKLIST_NAV_TAB;
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

/** Tasks nav tabs by role profile. */
export function tasksNavTabsForUser(
  billingAccess: boolean,
  profile: NavUserProfile = "full",
  options?: { canViewLiaisonTab?: boolean; canViewPresenceTab?: boolean }
): typeof TASKS_NAV_TABS {
  let tabs: typeof TASKS_NAV_TABS;
  if (profile === "associate") {
    tabs = pickTasksNavTabs(ASSOCIATE_TASKS_NAV_TAB_IDS);
  } else if (profile === "tasks-only" || !billingAccess) {
    tabs = pickTasksNavTabs(TASKS_ONLY_NAV_TAB_IDS);
  } else if (profile === "secretary") {
    tabs = pickTasksNavTabs(SECRETARY_TASKS_NAV_TAB_IDS);
  } else {
    tabs = pickTasksNavTabs(FULL_TASKS_NAV_TAB_IDS);
  }

  if (options?.canViewLiaisonTab && !tabs.some((tab) => tab.id === "liaison")) {
    const liaisonTab = TASKS_NAV_TABS.find((entry) => entry.id === "liaison");
    if (liaisonTab) tabs = [...tabs, liaisonTab];
  }

  if (options?.canViewPresenceTab && !tabs.some((tab) => tab.id === "presence")) {
    const presenceTab = TASKS_NAV_TABS.find((entry) => entry.id === "presence");
    if (presenceTab) tabs = [...tabs, presenceTab];
  }

  return tabs;
}

export function isAllowedTasksTab(
  tab: SavedTasksTab,
  billingAccess: boolean,
  profile: NavUserProfile = "full",
  options?: { canViewLiaisonTab?: boolean; canViewPresenceTab?: boolean }
): boolean {
  if (tab === "presence") return options?.canViewPresenceTab === true;
  if (tab === "liaison") return options?.canViewLiaisonTab === true;
  if (tab === "correspondence" && profile === "associate") return true;
  if (tab === "correspondence" && !billingAccess && profile !== "associate") return false;
  const resolved = profile === "full" && !billingAccess ? "tasks-only" : profile;
  if (resolved === "full" && billingAccess) return true;
  if (resolved === "associate") return ASSOCIATE_TASKS_NAV_TAB_IDS.includes(tab);
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
