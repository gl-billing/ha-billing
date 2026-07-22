/**
 * Clio-style primary navigation for Hernandez & Associates.
 * Layout matches Practice Clio (left rail + sub-tabs); labels and gates stay HA.
 * Every SavedBillingPage and SavedTasksTab appears at least once.
 */

import type { SavedBillingPage, SavedTasksTab } from "@/lib/staff-prefs";
import { firmAppHref, getTasksAppUrl } from "@/lib/firm-apps";
import {
  BILLING_PAGE_DESCRIPTIONS,
  BILLING_PAGE_LABELS,
  isAllowedBillingPage,
  isAllowedTasksTab,
  TASKS_TAB_DESCRIPTIONS,
  TASKS_TAB_LABELS,
  type NavUserProfile
} from "@/lib/workspace-labels";

export const HA_BILLING_PATH = "/billing";
export const HA_TASKS_PATH = firmAppHref("/app", getTasksAppUrl()) || "/app";

export type ClioPathOptions = {
  billingPath?: string;
  tasksPath?: string;
};

export type ClioNavId =
  | "checklist"
  | "calendar"
  | "matters"
  | "contacts"
  | "activities"
  | "billing"
  | "documents"
  | "communications"
  | "reports"
  | "dashboard"
  | "settings";

export type ClioSection = {
  id: string;
  label: string;
  description: string;
  billingPage?: SavedBillingPage;
  tasksTab?: SavedTasksTab;
  /** Calendar primary only — day hourly / week planner / month calendar. */
  calendarMode?: "day" | "week" | "month";
  adminOnly?: boolean;
  /** HA firm-owner attendance register. */
  presenceOnly?: boolean;
  /** HA liaison confidential queue. */
  liaisonOnly?: boolean;
};

export type ClioPrimary = {
  id: ClioNavId;
  label: string;
  description: string;
  app: "billing" | "tasks";
  sections: ClioSection[];
  defaultSectionId: string;
};

export type ClioVisibilityOptions = {
  billingAccess: boolean;
  navProfile: NavUserProfile;
  isAdmin?: boolean;
  email?: string | null;
  canManageTeamRoster?: boolean;
  canViewLiaisonTab?: boolean;
  canViewPresenceTab?: boolean;
};

/** Full HA inventory mapped into Clio primaries. */
export const HA_CLIO_NAV: ClioPrimary[] = [
  {
    id: "checklist",
    label: "My work",
    description: "Assigned work for today — overdue first, then due today.",
    app: "tasks",
    defaultSectionId: "today",
    sections: [
      {
        id: "today",
        label: TASKS_TAB_LABELS.today,
        description: TASKS_TAB_DESCRIPTIONS.today,
        tasksTab: "today"
      }
    ]
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Day board, week planner, and month calendar.",
    app: "tasks",
    defaultSectionId: "week",
    sections: [
      {
        id: "day",
        label: "Day",
        description: "Hourly schedule for one day — hearings and meetings with start times.",
        tasksTab: "week",
        calendarMode: "day"
      },
      {
        id: "week",
        label: "Week",
        description: TASKS_TAB_DESCRIPTIONS.week,
        tasksTab: "week",
        calendarMode: "week"
      },
      {
        id: "month",
        label: "Month",
        description: TASKS_TAB_DESCRIPTIONS.calendar,
        tasksTab: "calendar",
        calendarMode: "month"
      }
    ]
  },
  {
    id: "matters",
    label: "Matters",
    description: "Walk-ins, intake, and short matters.",
    app: "billing",
    defaultSectionId: "all",
    sections: [
      {
        id: "all",
        label: "Active matters",
        description: "Open client files and matter caseload — retained clients, walk-ins, and intake.",
        billingPage: "clients"
      },
      {
        id: "walkIns",
        label: BILLING_PAGE_LABELS.walkIns,
        description: BILLING_PAGE_DESCRIPTIONS.walkIns,
        billingPage: "walkIns"
      },
      {
        id: "notarizations",
        label: BILLING_PAGE_LABELS.notarizations,
        description: BILLING_PAGE_DESCRIPTIONS.notarizations,
        billingPage: "notarizations"
      },
      {
        id: "intake",
        label: BILLING_PAGE_LABELS.newClient,
        description: BILLING_PAGE_DESCRIPTIONS.newClient,
        billingPage: "newClient"
      },
      {
        id: "fieldDispatch",
        label: BILLING_PAGE_LABELS.fieldDispatch,
        description: BILLING_PAGE_DESCRIPTIONS.fieldDispatch,
        billingPage: "fieldDispatch",
        adminOnly: true
      }
    ]
  },
  {
    id: "contacts",
    label: "Contacts",
    description: "Client directory — search names, codes, phone, and email.",
    app: "billing",
    defaultSectionId: "clients",
    sections: [
      {
        id: "clients",
        label: BILLING_PAGE_LABELS.clients,
        description: BILLING_PAGE_DESCRIPTIONS.clients,
        billingPage: "clients"
      }
    ]
  },
  {
    id: "activities",
    label: "Activities",
    description: "Create tasks and events, and browse open items.",
    app: "tasks",
    defaultSectionId: "all",
    sections: [
      {
        id: "add-task",
        label: TASKS_TAB_LABELS["add-task"],
        description: TASKS_TAB_DESCRIPTIONS["add-task"],
        tasksTab: "add-task"
      },
      {
        id: "add-event",
        label: TASKS_TAB_LABELS["add-event"],
        description: TASKS_TAB_DESCRIPTIONS["add-event"],
        tasksTab: "add-event"
      },
      {
        id: "all",
        label: TASKS_TAB_LABELS["all-items"],
        description: TASKS_TAB_DESCRIPTIONS["all-items"],
        tasksTab: "all-items"
      }
    ]
  },
  {
    id: "billing",
    label: "Billing",
    description: "Fees, one-time payments, statements, and payroll.",
    app: "billing",
    defaultSectionId: "charges",
    sections: [
      {
        id: "charges",
        label: BILLING_PAGE_LABELS.billing,
        description: BILLING_PAGE_DESCRIPTIONS.billing,
        billingPage: "billing"
      },
      {
        id: "spotBilling",
        label: BILLING_PAGE_LABELS.spotBilling,
        description: BILLING_PAGE_DESCRIPTIONS.spotBilling,
        billingPage: "spotBilling"
      },
      {
        id: "soa",
        label: BILLING_PAGE_LABELS.documents,
        description: BILLING_PAGE_DESCRIPTIONS.documents,
        billingPage: "documents"
      },
      {
        id: "history",
        label: BILLING_PAGE_LABELS.history,
        description: BILLING_PAGE_DESCRIPTIONS.history,
        billingPage: "history"
      },
      {
        id: "finances",
        label: BILLING_PAGE_LABELS.firmFinances,
        description: BILLING_PAGE_DESCRIPTIONS.firmFinances,
        billingPage: "firmFinances",
        adminOnly: true
      },
      {
        id: "salary",
        label: BILLING_PAGE_LABELS.staffSalary,
        description: BILLING_PAGE_DESCRIPTIONS.staffSalary,
        billingPage: "staffSalary",
        adminOnly: true
      }
    ]
  },
  {
    id: "documents",
    label: "Documents",
    description: "Generate statements and receipts.",
    app: "billing",
    defaultSectionId: "generate",
    sections: [
      {
        id: "generate",
        label: "Generate",
        description: BILLING_PAGE_DESCRIPTIONS.documents,
        billingPage: "documents"
      }
    ]
  },
  {
    id: "communications",
    label: "Communications",
    description: "Letters on firm letterhead.",
    app: "tasks",
    defaultSectionId: "letters",
    sections: [
      {
        id: "letters",
        label: TASKS_TAB_LABELS.correspondence,
        description: TASKS_TAB_DESCRIPTIONS.correspondence,
        tasksTab: "correspondence"
      }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    description: "Firm reports, staff load, completed work, and liaison.",
    app: "billing",
    defaultSectionId: "reports",
    sections: [
      {
        id: "reports",
        label: BILLING_PAGE_LABELS.reports,
        description: BILLING_PAGE_DESCRIPTIONS.reports,
        billingPage: "reports"
      },
      {
        id: "team",
        label: TASKS_TAB_LABELS.team,
        description: TASKS_TAB_DESCRIPTIONS.team,
        tasksTab: "team"
      },
      {
        id: "history",
        label: TASKS_TAB_LABELS.history,
        description: TASKS_TAB_DESCRIPTIONS.history,
        tasksTab: "history"
      },
      {
        id: "liaison",
        label: TASKS_TAB_LABELS.liaison,
        description: TASKS_TAB_DESCRIPTIONS.liaison,
        tasksTab: "liaison",
        liaisonOnly: true
      }
    ]
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: BILLING_PAGE_DESCRIPTIONS.home,
    app: "billing",
    defaultSectionId: "home",
    sections: [
      {
        id: "home",
        label: BILLING_PAGE_LABELS.home,
        description: BILLING_PAGE_DESCRIPTIONS.home,
        billingPage: "home"
      }
    ]
  },
  {
    id: "settings",
    label: "Administration",
    description: "Tools, sync, and staff attendance.",
    app: "tasks",
    defaultSectionId: "firm",
    sections: [
      {
        id: "firm",
        label: TASKS_TAB_LABELS.tools,
        description: TASKS_TAB_DESCRIPTIONS.tools,
        tasksTab: "tools"
      },
      {
        id: "presence",
        label: TASKS_TAB_LABELS.presence,
        description: TASKS_TAB_DESCRIPTIONS.presence,
        tasksTab: "presence",
        presenceOnly: true
      }
    ]
  }
];

const STORAGE_KEY = "ha-clio-nav-v1";

export function findClioPrimary(id: ClioNavId): ClioPrimary {
  return HA_CLIO_NAV.find((item) => item.id === id) || HA_CLIO_NAV[0];
}

export function findClioSection(primary: ClioPrimary, sectionId: string | null | undefined): ClioSection {
  return (
    primary.sections.find((section) => section.id === sectionId) ||
    primary.sections.find((section) => section.id === primary.defaultSectionId) ||
    primary.sections[0]
  );
}

export function isClioSectionAllowed(section: ClioSection, options: ClioVisibilityOptions): boolean {
  const {
    billingAccess,
    navProfile,
    isAdmin = false,
    email = null,
    canManageTeamRoster = false,
    canViewLiaisonTab = false,
    canViewPresenceTab = false
  } = options;

  if (section.adminOnly && !isAdmin && !(section.billingPage === "staffSalary" && canManageTeamRoster)) {
    return false;
  }
  if (section.presenceOnly && !canViewPresenceTab) return false;
  if (section.liaisonOnly && !canViewLiaisonTab) return false;

  const tabOpts = { canViewLiaisonTab, canViewPresenceTab };

  if (section.tasksTab) {
    return isAllowedTasksTab(section.tasksTab, billingAccess, navProfile, tabOpts);
  }

  if (section.billingPage) {
    if (!billingAccess) return false;
    return isAllowedBillingPage(section.billingPage, isAdmin, navProfile, email, canManageTeamRoster);
  }

  return billingAccess && navProfile === "full";
}

export function clioSectionsForUser(primary: ClioPrimary, options: ClioVisibilityOptions): ClioSection[] {
  return primary.sections.filter((section) => isClioSectionAllowed(section, options));
}

export function clioPrimariesForUser(options: ClioVisibilityOptions): ClioPrimary[] {
  return HA_CLIO_NAV.filter((primary) => clioSectionsForUser(primary, options).length > 0);
}

export function defaultClioSectionForUser(primary: ClioPrimary, options: ClioVisibilityOptions): ClioSection {
  const allowed = clioSectionsForUser(primary, options);
  if (!allowed.length) return findClioSection(primary, primary.defaultSectionId);
  const preferred = allowed.find((section) => section.id === primary.defaultSectionId);
  return preferred || allowed[0];
}

export function resolveClioFromBillingPage(page: SavedBillingPage): { nav: ClioNavId; section: string } {
  if (page === "clients") return { nav: "contacts", section: "clients" };
  if (page === "spotBilling") return { nav: "billing", section: "spotBilling" };
  if (page === "walkIns") return { nav: "matters", section: "walkIns" };
  if (page === "notarizations") return { nav: "matters", section: "notarizations" };
  if (page === "newClient") return { nav: "matters", section: "intake" };
  if (page === "fieldDispatch") return { nav: "matters", section: "fieldDispatch" };
  if (page === "documents") return { nav: "documents", section: "generate" };
  if (page === "billing") return { nav: "billing", section: "charges" };
  if (page === "history") return { nav: "billing", section: "history" };
  if (page === "firmFinances") return { nav: "billing", section: "finances" };
  if (page === "staffSalary") return { nav: "billing", section: "salary" };
  if (page === "reports") return { nav: "reports", section: "reports" };
  if (page === "home") return { nav: "dashboard", section: "home" };

  for (const primary of HA_CLIO_NAV) {
    for (const section of primary.sections) {
      if (section.billingPage === page) {
        return { nav: primary.id, section: section.id };
      }
    }
  }
  return { nav: "dashboard", section: "home" };
}

export function resolveClioFromTasksTab(
  tab: SavedTasksTab,
  calendarMode?: "day" | "week" | "month" | null
): { nav: ClioNavId; section: string } {
  if (tab === "calendar") return { nav: "calendar", section: "month" };
  if (tab === "week") return { nav: "calendar", section: calendarMode === "day" ? "day" : "week" };
  // calendarMode only applies to the week tab — never remap My work → Calendar Day.
  if (tab === "today") return { nav: "checklist", section: "today" };
  if (tab === "correspondence") return { nav: "communications", section: "letters" };
  if (tab === "tools") return { nav: "settings", section: "firm" };
  if (tab === "presence") return { nav: "settings", section: "presence" };
  if (tab === "team") return { nav: "reports", section: "team" };
  if (tab === "history") return { nav: "reports", section: "history" };
  if (tab === "liaison") return { nav: "reports", section: "liaison" };
  for (const primary of HA_CLIO_NAV) {
    for (const section of primary.sections) {
      if (section.tasksTab === tab) return { nav: primary.id, section: section.id };
    }
  }
  return { nav: "activities", section: findClioPrimary("activities").defaultSectionId };
}

export function buildClioHref(nav: ClioNavId, sectionId?: string, options?: ClioPathOptions): string {
  const billingPath = options?.billingPath || HA_BILLING_PATH;
  const tasksPath = options?.tasksPath || HA_TASKS_PATH;
  const primary = findClioPrimary(nav);
  const section = findClioSection(primary, sectionId);

  if (section.tasksTab) {
    const params = new URLSearchParams();
    params.set("nav", nav);
    params.set("section", section.id);
    params.set("tab", section.tasksTab);
    if (section.calendarMode) params.set("cal", section.calendarMode);
    return `${tasksPath}?${params.toString()}`;
  }

  if (section.billingPage) {
    const params = new URLSearchParams();
    params.set("nav", nav);
    params.set("section", section.id);
    params.set("page", section.billingPage);
    return `${billingPath}?${params.toString()}`;
  }

  return billingPath;
}

export function readSavedClioNav(): { nav: ClioNavId; section: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nav?: string; section?: string };
    if (!parsed.nav || !HA_CLIO_NAV.some((item) => item.id === parsed.nav)) return null;
    return { nav: parsed.nav as ClioNavId, section: parsed.section || "" };
  } catch {
    return null;
  }
}

export function saveClioNav(nav: ClioNavId, section: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nav, section }));
  } catch {
    /* ignore */
  }
}

export function parseClioNavParam(value: string | null | undefined): ClioNavId | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return HA_CLIO_NAV.some((item) => item.id === normalized) ? (normalized as ClioNavId) : null;
}

/** Read Calendar day/week/month mode from URL (`cal` or calendar `section`). */
export function parseCalendarModeParam(
  params: URLSearchParams | string
): "day" | "week" | "month" | null {
  const search = typeof params === "string" ? new URLSearchParams(params) : params;
  const cal = search.get("cal")?.trim().toLowerCase();
  if (cal === "day" || cal === "week" || cal === "month") return cal;
  if (parseClioNavParam(search.get("nav")) !== "calendar") return null;
  const sectionId = search.get("section")?.trim().toLowerCase();
  if (sectionId === "day" || sectionId === "week" || sectionId === "month") return sectionId;
  return null;
}
