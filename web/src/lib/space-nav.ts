/**
 * Bitrix Space → HA route map. No fake Bitrix modules (Sites, BI Builder, etc.).
 * Space shell is always on for HA — no firm-plan entitlements or trial/test-lab routes.
 */

import { billingHref, walkInConsultationCreateHref } from "@/lib/billing-routes";
import { tasksHref, correspondenceHref } from "@/lib/tasks-routes";
import type { NavTabDef, NavUserProfile } from "@/lib/workspace-labels";

/** Bitrix Calendar sub-views (Day / Week / Month / Schedule). */
export type SpaceCalendarView = "day" | "week" | "month" | "schedule";

export type SpaceNavId =
  | "start"
  | "messenger"
  | "team"
  | "tasks"
  | "calendar"
  | "crm"
  | "accounts"
  | "booking"
  | "filing"
  | "templates"
  | "drive"
  | "communications"
  | "reports"
  | "notifications"
  | "administration"
  | "settings";

export type SpaceNavGroup = "collaboration" | "workspace";

export type SpaceNavItem = {
  id: SpaceNavId;
  label: string;
  description: string;
  href: string;
  group?: SpaceNavGroup;
  /** Shown in the Bitrix-style top module strip. */
  topNav?: boolean;
  /** Footer rail (Settings). */
  footer?: boolean;
  billingOnly?: boolean;
  adminOnly?: boolean;
  /** Tasks-only / liaison may see this. */
  tasksOnlyOk?: boolean;
};

type Visibility = {
  billingAccess: boolean;
  navProfile?: NavUserProfile;
  isAdmin?: boolean;
};

function withSpaceParam(
  href: string,
  space: "messenger" | "staff" | "drive" | "notifications" | "templates" | "communications"
): string {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}space=${space}`;
}

/** Client messaging desk under Communications. */
export function clientMessagingHref(options?: { compose?: boolean; clientCode?: string }): string {
  const base = withSpaceParam(tasksHref({ tab: "today" }), "communications");
  const params = new URLSearchParams();
  params.set("panel", "client-messaging");
  if (options?.compose) params.set("compose", "1");
  if (options?.clientCode) params.set("client", options.clientCode.trim().toUpperCase());
  return `${base}&${params.toString()}`;
}

function notificationsHref(): string {
  return withSpaceParam(tasksHref({ tab: "today" }), "notifications");
}

/** Declarative Space rail catalog (Bitrix concepts → existing HA routes). */
export function spaceNavCatalog(v: Visibility): SpaceNavItem[] {
  return [
    {
      id: "start",
      label: "Feed",
      description: "Checklist & today’s desk",
      href: tasksHref({ tab: "desk-checklist" }),
      group: "collaboration",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "messenger",
      label: "Messenger",
      description: "Staff chats & messages",
      href: withSpaceParam(tasksHref({ tab: "today" }), "messenger"),
      group: "collaboration",
      tasksOnlyOk: true
    },
    {
      id: "team",
      label: "Collaboration",
      description: "Team board",
      href: tasksHref({ tab: "team" }),
      group: "collaboration",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "tasks",
      label: "Tasks and Projects",
      description: "Checklist & open work",
      href: tasksHref({ tab: "all-items" }),
      group: "workspace",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "calendar",
      label: "Calendar",
      description: "Hearings & schedule",
      href: (() => {
        const base = tasksHref({ tab: "week" });
        return `${base}${base.includes("?") ? "&" : "?"}cal=day`;
      })(),
      group: "workspace",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "crm",
      label: "Client Directory",
      description: "Case clients",
      href: billingHref({ page: "clients" }),
      group: "workspace",
      topNav: true,
      billingOnly: true
    },
    {
      id: "accounts",
      label: "Accounts",
      description: "Billing, SOA & receipts, history",
      href: billingHref({ page: "billing" }),
      group: "workspace",
      topNav: true,
      billingOnly: true
    },
    {
      id: "booking",
      label: "Booking",
      description: "Client intake, walk-ins, spot billing & notarizations",
      href: billingHref({ page: "walkIns" }),
      group: "workspace",
      topNav: true,
      billingOnly: true
    },
    {
      id: "filing",
      label: "Filing",
      description: "E-filing & physical queues",
      href: tasksHref({ tab: "filing" }),
      group: "workspace",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "templates",
      label: "Templates",
      description: "Firm letter & form starters",
      href: tasksHref({ tab: "templates" }),
      group: "workspace",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "drive",
      label: "Drive",
      description: "Document vault — status reports & outbound PDFs",
      href: withSpaceParam(billingHref({ page: "documents" }), "drive"),
      group: "workspace",
      topNav: true,
      billingOnly: true
    },
    {
      id: "communications",
      label: "Communications",
      description: "Letters & client messaging",
      href: withSpaceParam(correspondenceHref(), "communications"),
      group: "workspace",
      topNav: true,
      billingOnly: true
    },
    {
      id: "reports",
      label: "Reports",
      description: "Firm insights",
      href: billingHref({ page: "reports" }),
      group: "workspace",
      topNav: true,
      billingOnly: true,
      adminOnly: true
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Alerts & follow-ups",
      href: notificationsHref(),
      group: "workspace",
      tasksOnlyOk: true
    },
    {
      id: "administration",
      label: "Administration",
      description: "Tools, staff roster, payroll & attendance",
      href: tasksHref({ tab: "tools" }),
      group: "workspace",
      topNav: true,
      tasksOnlyOk: true
    },
    {
      id: "settings",
      label: "Settings",
      description: "Integrations & firm settings",
      href: (() => {
        const base = tasksHref({ tab: "tools" });
        return `${base}${base.includes("?") ? "&" : "?"}panel=integrations`;
      })(),
      footer: true,
      tasksOnlyOk: true
    }
  ];
}

function visibleSpaceItems(v: Visibility): SpaceNavItem[] {
  return spaceNavCatalog(v).filter((item) => {
    if (item.adminOnly && !v.isAdmin) return false;
    if (item.billingOnly && !v.billingAccess) {
      // Associates draft letters / message clients without full billing desk.
      if (v.navProfile === "associate" && item.id === "communications") {
        return true;
      }
      return false;
    }
    if (!v.billingAccess && !item.tasksOnlyOk && !item.footer) return false;
    return true;
  });
}

export function spaceNavItemsForUser(v: Visibility): {
  collaboration: SpaceNavItem[];
  workspace: SpaceNavItem[];
  primary: SpaceNavItem[];
  footer: SpaceNavItem[];
  topNav: SpaceNavItem[];
} {
  const all = visibleSpaceItems(v);
  const collaboration = all.filter((i) => !i.footer && i.group === "collaboration");
  const workspace = all.filter((i) => !i.footer && i.group !== "collaboration");
  return {
    collaboration,
    workspace,
    primary: [...collaboration, ...workspace],
    footer: all.filter((i) => i.footer),
    topNav: all.filter((i) => i.topNav && !i.footer)
  };
}

export type MobileOfficeMenuLink = { href: string; label: string };
export type MobileOfficeMenuGroup = { label: string; links: MobileOfficeMenuLink[] };

function withQueryParam(href: string, key: string, value: string): string {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

/** Native phone home — Today’s Office on the tasks desk. */
export function mobileOfficeHomeHref(): string {
  return tasksHref({ tab: "desk-checklist" });
}

/** True when the phone header should hide Back (Today’s Office is already showing). */
export function isMobileOfficeHomePath(pathname: string, search = ""): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/office-hub" || path.endsWith("/office-hub")) return true;
  const onTasksApp = path === "/app" || path.endsWith("/app");
  if (!onTasksApp) return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = (params.get("tab") || "desk-checklist").trim().toLowerCase();
  if (params.get("mo") || params.get("moItem")) return false;
  if ((params.get("space") || "").trim().toLowerCase() === "notifications") return false;
  if (tab === "add-task" || tab === "add-event") return false;
  return tab === "desk-checklist" || tab === "today" || tab === "";
}

/** Hamburger destinations on the dedicated phone home — filtered by role. */
export function mobileHomeMenuLinks(v: Visibility): MobileOfficeMenuLink[] {
  const home = mobileOfficeHomeHref();
  const calendar = withQueryParam(tasksHref({ tab: "week" }), "cal", "day");
  const billingOk = Boolean(v.billingAccess) && v.navProfile !== "tasks-only";
  const links: MobileOfficeMenuLink[] = [
    { href: home, label: "Home" },
    { href: tasksHref({ tab: "add-task" }), label: "Add Task" },
    { href: tasksHref({ tab: "add-event" }), label: "Add Event" }
  ];
  if (billingOk) {
    links.push({ href: billingHref({ page: "clients" }), label: "Clients and Matters" });
  }
  links.push({ href: calendar, label: "Calendar" });
  links.push({ href: tasksHref({ tab: "all-items" }), label: "Tasks" });
  links.push({ href: notificationsHref(), label: "Notifications" });
  if (billingOk) {
    links.push({ href: billingHref({ page: "billing" }), label: "Billing and Ledger" });
    links.push({ href: billingHref({ page: "documents", docTab: "soa" }), label: "Statements of Account" });
    links.push({ href: billingHref({ page: "documents", docTab: "ar" }), label: "Accounts Receivable" });
  }
  if (v.isAdmin) {
    links.push({ href: withSpaceParam(tasksHref({ tab: "tools" }), "staff"), label: "Staff" });
  }
  if (billingOk && v.isAdmin) {
    links.push({ href: billingHref({ page: "reports" }), label: "Reports" });
  }
  links.push({ href: tasksHref({ tab: "tools" }), label: "Settings" });
  return links;
}

/** Hamburger categories on the native phone home. */
export function mobileOfficeMenuGroups(v: Visibility): MobileOfficeMenuGroup[] {
  const billingOk = Boolean(v.billingAccess) && v.navProfile !== "tasks-only";
  const groups: MobileOfficeMenuGroup[] = [];
  if (billingOk) {
    groups.push({
      label: "Booking or adding",
      links: [
        { href: billingHref({ page: "newClient" }), label: "Add client" },
        { href: walkInConsultationCreateHref(), label: "Add walk-in" },
        { href: tasksHref({ tab: "add-task" }), label: "Add task" },
        { href: tasksHref({ tab: "add-event" }), label: "Add event" }
      ]
    });
  }
  groups.push({ label: "Office", links: mobileHomeMenuLinks(v) });
  return groups;
}

/** Primary Create action for the active Space module (Bitrix-style + Create). */
export function spaceCreateAction(
  activeId: SpaceNavId,
  v: Pick<Visibility, "billingAccess">
): { href: string; label: string } {
  switch (activeId) {
    case "crm":
      return {
        href: billingHref({ page: "clients" }),
        label: "Clients"
      };
    case "accounts":
      return {
        href: billingHref({ page: "billing" }),
        label: "Billing"
      };
    case "booking":
      return {
        href: billingHref({ page: "newClient" }),
        label: "Client intake"
      };
    case "calendar":
      return {
        href: tasksHref({ tab: "add-event" }),
        label: "Add event"
      };
    case "tasks":
    case "start":
      return {
        href: tasksHref({ tab: "add-task" }),
        label: "Add task"
      };
    case "filing":
      return {
        href: tasksHref({ tab: "filing" }),
        label: "Filing queues"
      };
    case "team":
      return {
        href: tasksHref({ tab: "team" }),
        label: "Team board"
      };
    case "templates":
      return {
        href: tasksHref({ tab: "templates" }),
        label: "Upload template"
      };
    case "communications":
      return {
        href: withSpaceParam(correspondenceHref(), "communications"),
        label: "Draft letter"
      };
    case "drive":
      return {
        href: withSpaceParam(billingHref({ page: "documents" }), "drive"),
        label: "Document vault"
      };
    case "messenger":
      return {
        href: `${withSpaceParam(tasksHref({ tab: "today" }), "messenger")}&compose=1`,
        label: "Message"
      };
    case "reports":
      return {
        href: billingHref({ page: "reports" }),
        label: "Reports"
      };
    case "notifications":
      return {
        href: notificationsHref(),
        label: "Notifications"
      };
    case "administration":
      return {
        href: tasksHref({ tab: "tools" }),
        label: "Administration"
      };
    case "settings":
      return {
        href: spaceTasksExtraHref("integrations") || tasksHref({ tab: "tools" }),
        label: "Settings"
      };
    default:
      return {
        href: tasksHref({ tab: "add-task" }),
        label: "Create"
      };
  }
}

export function spaceInviteHref(_v?: Pick<Visibility, "billingAccess">): string {
  return withSpaceParam(tasksHref({ tab: "tools" }), "staff");
}

export function spaceTeamHref(_v?: Pick<Visibility, "billingAccess">): string {
  return tasksHref({ tab: "team" });
}

/**
 * Bitrix-style top strip: brand + search + utilities only.
 * Module switching lives on the left rail (and mobile bottom nav) — avoid dual nav.
 */
const SPACE_TOP_CONTEXT: Record<SpaceNavId, SpaceNavId[]> = {
  start: [],
  messenger: [],
  team: [],
  tasks: [],
  calendar: [],
  crm: [],
  accounts: [],
  booking: [],
  filing: [],
  templates: [],
  drive: [],
  communications: [],
  reports: [],
  notifications: [],
  administration: [],
  settings: []
};

/**
 * In-panel section tabs for Tasks app — scoped to HA tabs that exist.
 */
const SPACE_TASKS_SECTION_TABS: Record<SpaceNavId, string[]> = {
  start: ["office-hub", "desk-checklist", "today", "history"],
  messenger: [],
  team: ["team"],
  /* Find lives in the desk toolbar search field — not a hero section tab. */
  tasks: ["add-task", "add-event"],
  calendar: [],
  crm: [],
  accounts: [],
  booking: [],
  filing: ["filing-e", "filing-physical"],
  templates: ["templates"],
  drive: [],
  communications: ["correspondence", "client-messaging"],
  reports: [],
  notifications: ["notifications"],
  /* Admin desk: tools + staff roster + attendance + payroll (extras / navTabs gate visibility). */
  administration: ["tools", "staff", "presence", "payroll"],
  /* Integrations / firm connectors — former Settings desk content. */
  settings: ["integrations"]
};

/** Space-only / cross-route section tabs injected into Tasks modules. */
const SPACE_TASKS_EXTRA_TABS: NavTabDef<string>[] = [
  {
    id: "office-hub",
    label: "Office Hub",
    description: "Launchers, announcements, role desks, and automation health."
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Google, Sheets, and document storage connectors."
  },
  {
    id: "filing-e",
    label: "Electronic Filing",
    description: "E-filing queue for court submissions."
  },
  {
    id: "filing-physical",
    label: "Personal Service / Mail / Courier",
    description: "Registered mail, private courier, and personal service queues."
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and follow-ups."
  },
  {
    id: "client-messaging",
    label: "Message clients",
    description: "Email clients from the firm desk."
  },
  {
    id: "staff",
    label: "Staff",
    description: "Staff directory and ledger.",
    adminOnly: true
  },
  {
    id: "payroll",
    label: "Payroll",
    description: "Semi-monthly staff payroll and allowances.",
    adminOnly: true
  }
];

export function isSpaceTasksExtraTab(id: string): boolean {
  return SPACE_TASKS_EXTRA_TABS.some((tab) => tab.id === id);
}

/** Href for Space tasks extras (Hub / Integrations / filing queues / admin desks). */
export function spaceTasksExtraHref(id: string): string | null {
  if (id === "office-hub") return "/office-hub";
  if (id === "integrations") {
    const base = tasksHref({ tab: "tools" });
    return `${base}${base.includes("?") ? "&" : "?"}panel=integrations`;
  }
  if (id === "filing-e") {
    const base = tasksHref({ tab: "filing" });
    return `${base}${base.includes("?") ? "&" : "?"}filingQueue=e-filing`;
  }
  if (id === "filing-physical") {
    const base = tasksHref({ tab: "filing" });
    return `${base}${base.includes("?") ? "&" : "?"}filingQueue=physical`;
  }
  if (id === "notifications") return notificationsHref();
  if (id === "client-messaging") return clientMessagingHref();
  if (id === "staff") return withSpaceParam(tasksHref({ tab: "tools" }), "staff");
  if (id === "payroll") return billingHref({ page: "staffSalary" });
  return null;
}

/** Bitrix Tasks content tabs — prefer section tabs from SPACE_TASKS_SECTION_TABS. */
export const SPACE_TASKS_VIEW_TABS: NavTabDef<"all-items">[] = [];

export function spaceTasksViewTabs(): NavTabDef<"all-items" | "desk-checklist">[] {
  return SPACE_TASKS_VIEW_TABS;
}

/** Create menu options (Bitrix + Create dropdown). */
export function spaceCreateMenu(
  activeId: SpaceNavId,
  v: Pick<Visibility, "billingAccess" | "isAdmin">
): { label: string; href: string }[] {
  if (activeId === "tasks" || activeId === "start" || activeId === "calendar") {
    return [
      { label: "Walk-in consultation", href: walkInConsultationCreateHref() },
      { label: "Create task", href: tasksHref({ tab: "add-task" }) },
      { label: "Create event", href: tasksHref({ tab: "add-event" }) }
    ];
  }
  if (activeId === "crm") {
    return [
      { label: "New client", href: billingHref({ page: "newClient" }) },
      { label: "Case clients", href: billingHref({ page: "clients" }) },
      { label: "Walk-in consultation", href: walkInConsultationCreateHref() }
    ];
  }
  if (activeId === "accounts") {
    return [
      { label: "Billing", href: billingHref({ page: "billing" }) },
      { label: "SOA & Receipts", href: billingHref({ page: "documents" }) }
    ];
  }
  if (activeId === "booking") {
    return [
      { label: "Client intake", href: billingHref({ page: "newClient" }) },
      { label: "Walk-in consultation", href: walkInConsultationCreateHref() },
      { label: "Spot billing", href: billingHref({ page: "spotBilling" }) },
      { label: "Notarization", href: billingHref({ page: "notarizations" }) }
    ];
  }
  if (activeId === "drive" && v.billingAccess) {
    return [
      { label: "Document vault", href: withSpaceParam(billingHref({ page: "documents" }), "drive") },
      { label: "Pick client for SOA", href: billingHref({ page: "clients" }) }
    ];
  }
  if (activeId === "filing") {
    return [
      { label: "Open Today checklist", href: tasksHref({ tab: "desk-checklist" }) },
      { label: "Add filing deadline", href: tasksHref({ tab: "add-event" }) }
    ];
  }
  if (activeId === "team") {
    return [{ label: "Team board", href: tasksHref({ tab: "team" }) }];
  }
  if (activeId === "administration") {
    const items: { label: string; href: string }[] = [
      { label: "Administration", href: tasksHref({ tab: "tools" }) }
    ];
    if (v.isAdmin) {
      items.push(
        { label: "Staff", href: spaceTasksExtraHref("staff") || tasksHref({ tab: "tools" }) },
        { label: "Staff attendance", href: tasksHref({ tab: "presence" }) },
        { label: "Payroll", href: spaceTasksExtraHref("payroll") || billingHref({ page: "staffSalary" }) }
      );
    }
    return items;
  }
  if (activeId === "settings") {
    return [
      {
        label: "Integrations",
        href: spaceTasksExtraHref("integrations") || tasksHref({ tab: "tools" })
      }
    ];
  }
  if (activeId === "messenger") {
    return [
      {
        label: "New message",
        href: `${withSpaceParam(tasksHref({ tab: "today" }), "messenger")}&compose=1`
      }
    ];
  }
  if (activeId === "templates") {
    return [{ label: "Upload template", href: tasksHref({ tab: "templates" }) }];
  }
  if (activeId === "communications") {
    return [
      { label: "Draft letter", href: withSpaceParam(correspondenceHref(), "communications") },
      { label: "Message client", href: clientMessagingHref({ compose: true }) }
    ];
  }
  return [];
}

/** Bitrix Calendar content tabs — Day, Week, Month, Schedule. */
export const SPACE_CALENDAR_VIEW_TABS: NavTabDef<SpaceCalendarView>[] = [
  {
    id: "day",
    label: "Day",
    description: "Hourly appointments for one day."
  },
  {
    id: "week",
    label: "Week",
    description: "Seven-day planner."
  },
  {
    id: "month",
    label: "Month",
    description: "Month calendar."
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Upcoming agenda list."
  }
];

export function spaceCalendarViewTabs(): NavTabDef<SpaceCalendarView>[] {
  return SPACE_CALENDAR_VIEW_TABS;
}

/** Map a Space calendar view to the underlying Tasks tab + cal mode. */
export function spaceCalendarViewTarget(view: SpaceCalendarView): {
  tab: "week" | "calendar";
  cal: SpaceCalendarView;
} {
  if (view === "month") return { tab: "calendar", cal: "month" };
  return { tab: "week", cal: view };
}

/**
 * In-panel section tabs for Billing app — scoped per Space module (HA pages only).
 */
const SPACE_BILLING_SECTION_PAGES: Record<SpaceNavId, string[]> = {
  start: [],
  messenger: [],
  team: [],
  tasks: [],
  calendar: [],
  crm: ["clients"],
  accounts: ["billing", "documents", "history", "home"],
  booking: ["newClient", "walkIns", "spotBilling", "notarizations"],
  filing: [],
  templates: [],
  drive: ["documents"],
  communications: [],
  reports: ["reports", "fieldDispatch", "firmFinances"],
  notifications: [],
  /* Payroll lives under Administration — section tabs come from filterSpaceTasksSectionTabs. */
  administration: [],
  settings: []
};

/** Filter Billing app nav tabs to the active Space module’s contents. */
export function filterSpaceBillingSectionTabs<T extends { id: string; label?: string; description?: string }>(
  activeId: SpaceNavId,
  tabs: T[]
): Array<T | NavTabDef<string>> {
  const allow = SPACE_BILLING_SECTION_PAGES[activeId] || [];
  if (allow.length === 0) return [];
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  const out: Array<T | NavTabDef<string>> = [];
  for (const id of allow) {
    const tab = byId.get(id);
    if (!tab) continue;
    if (id === "documents" && activeId === "drive") {
      out.push({
        ...tab,
        label: "Document vault",
        description: "Status Reports and other outbound PDFs by folder."
      });
      continue;
    }
    if (id === "documents" && activeId === "accounts") {
      out.push({
        ...tab,
        label: "SOA & Receipts",
        description: "Issue statements of account and acknowledgment receipts."
      });
      continue;
    }
    if (id === "newClient" && activeId === "booking") {
      out.push({
        ...tab,
        label: "Client intake",
        description: tab.description || "Start a new retained client."
      });
      continue;
    }
    if (id === "home" && activeId === "accounts") {
      out.push({ ...tab, label: "Firm Dashboard", description: tab.description || "Firm overview." });
      continue;
    }
    out.push(tab);
  }
  return out;
}

/** Top-nav links for the active Space module (Bitrix contextual strip). */
export function spaceTopContextTabs(activeId: SpaceNavId, v: Visibility): SpaceNavItem[] {
  const wanted = SPACE_TOP_CONTEXT[activeId] || [activeId];
  const byId = new Map(visibleSpaceItems(v).map((item) => [item.id, item]));
  return wanted.map((id) => byId.get(id)).filter((item): item is SpaceNavItem => Boolean(item));
}

/** Filter Tasks app nav tabs to the active Space module’s contents. */
export function filterSpaceTasksSectionTabs<T extends { id: string; label?: string; description?: string }>(
  activeId: SpaceNavId,
  tabs: T[],
  options?: { isAdmin?: boolean }
): Array<T | NavTabDef<string>> {
  const allow = SPACE_TASKS_SECTION_TABS[activeId] || [];
  if (allow.length === 0) return [];
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  const extras = new Map(SPACE_TASKS_EXTRA_TABS.map((tab) => [tab.id, tab]));
  const out: Array<T | NavTabDef<string>> = [];
  for (const id of allow) {
    if (extras.has(id)) {
      const extra = extras.get(id)!;
      if (extra.adminOnly && !options?.isAdmin) continue;
      out.push(extra);
      continue;
    }
    const tab = byId.get(id);
    if (tab) out.push(tab);
  }
  return out;
}

/** Resolve which Space rail item is active from the current path + query. */
export function resolveActiveSpaceNav(pathname: string, search: string): SpaceNavId {
  const path = pathname || "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab") || "";
  const page = params.get("page") || "";
  const space = (params.get("space") || "").toLowerCase();
  const panel = (params.get("panel") || "").toLowerCase();

  if (space === "messenger" || (typeof window !== "undefined" && window.location.hash.includes("space-messenger"))) {
    return "messenger";
  }
  /* Staff ledger nests under Administration (legacy space=employees still works). */
  if (space === "staff" || space === "employees") return "administration";
  if (space === "drive") return "drive";
  if (space === "notifications") return "notifications";
  /* Legacy Templates deep links that opened correspondence now land on Communications. */
  if (space === "templates" && tab === "correspondence") return "communications";
  if (space === "templates") return "templates";
  /* Legacy Mail deep links land on Communications. */
  if (space === "communications" || space === "mail" || panel === "client-messaging") {
    return "communications";
  }
  if (panel === "integrations" || space === "integrations" || space === "settings") return "settings";
  if (path.includes("/office-hub") || path.includes("/hub")) return "start";
  if (path.includes("/matter")) return "tasks";
  if (path.includes("/billing")) {
    const section = (params.get("section") || "").toLowerCase();
    if (
      page === "newClient" ||
      page === "walkIns" ||
      page === "spotBilling" ||
      page === "notarizations" ||
      section === "intake" ||
      section === "walkins" ||
      section === "notarizations" ||
      path.includes("walk")
    ) {
      return "booking";
    }
    if (page === "staffSalary" || section === "salary") return "administration";
    if (page === "reports" || page === "fieldDispatch" || page === "firmFinances") {
      return "reports";
    }
    if (page === "clients") return "crm";
    if (page === "billing" || page === "documents" || page === "history" || page === "home" || !page) {
      return "accounts";
    }
    return "accounts";
  }
  if (path.includes("/app")) {
    if (tab === "calendar" || tab === "week") return "calendar";
    if (tab === "filing") return "filing";
    if (tab === "templates") return "templates";
    if (tab === "correspondence") return "communications";
    if (tab === "notifications") return "notifications";
    if (tab === "tools" || tab === "presence") return "administration";
    if (tab === "team") return "team";
    if (tab === "all-items" || tab === "add-task" || tab === "add-event") return "tasks";
    if (tab === "desk-checklist" || tab === "today" || tab === "history" || !tab) {
      return "start";
    }
    return "tasks";
  }
  return "start";
}
