import { canAccessBilling } from "@/lib/app-access";
import { isAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { findNextHearing } from "@/lib/office-hub/next-hearing";
import { computeTodayCounts } from "@/lib/office-tasks/sheets/items";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import { dashboardFromMasterRows, getAllMasterRows } from "@/lib/sheets/master";
import { getOfficeAnnouncementState, type OfficeAnnouncementDraft } from "@/lib/sheets/settings";

export type OfficeHubSummary = {
  announcement: string | null;
  announcementDraft: OfficeAnnouncementDraft;
  isAdmin: boolean;
  tasks: {
    tasksDueToday: number;
    eventsToday: number;
    overdueOpen: number;
    nextHearing: ReturnType<typeof findNextHearing>;
  } | null;
  billingOverdueClients: number | null;
};

export function emptyOfficeHubSummary(email: string): OfficeHubSummary {
  return {
    announcement: null,
    announcementDraft: { message: "", from: "", until: "" },
    isAdmin: isAdminEmail(email),
    tasks: null,
    billingOverdueClients: null
  };
}

export async function loadOfficeHubSummary(email: string): Promise<OfficeHubSummary> {
  const token = await requireSessionAccessToken();
  const isAdmin = isAdminEmail(email);

  let announcement: string | null = null;
  let announcementDraft: OfficeAnnouncementDraft = { message: "", from: "", until: "" };

  try {
    const state = await getOfficeAnnouncementState(token);
    announcement = state.active;
    announcementDraft = state.draft;
  } catch (error) {
    console.error("[office-hub/summary] announcement", error);
  }

  let tasks: OfficeHubSummary["tasks"] = null;
  let billingOverdueClients: number | null = null;

  try {
    const items = await getCachedAllItems(token);
    const counts = computeTodayCounts(items);
    tasks = {
      tasksDueToday: counts.tasksDueToday,
      eventsToday: counts.eventsToday,
      overdueOpen: counts.overdueOpen,
      nextHearing: findNextHearing(items)
    };
  } catch (error) {
    console.error("[office-hub/summary] tasks", error);
  }

  if (canAccessBilling(email)) {
    try {
      const master = await getAllMasterRows(token);
      billingOverdueClients = dashboardFromMasterRows(master).overdueClients;
    } catch (error) {
      console.error("[office-hub/summary] billing", error);
    }
  }

  return {
    announcement,
    announcementDraft,
    isAdmin,
    tasks,
    billingOverdueClients
  };
}
