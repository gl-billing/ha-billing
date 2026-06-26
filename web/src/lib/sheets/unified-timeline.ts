import type { ActivityItem, ClientDetail, LedgerEntry } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";
import { mergeTaskTimelineItems } from "@/lib/task-matter-timeline";
import { taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";
import { getClientActivity } from "@/lib/sheets/activity";

export { getTaskMatterTimeline } from "@/lib/task-matter-timeline";

export async function getUnifiedClientTimeline(
  accessToken: string,
  clientCode: string,
  detail: ClientDetail,
  ledgerEntries?: LedgerEntry[],
  options?: {
    taskItems?: OfficeItem[];
    taskActivity?: TaskActivityEntry[];
    taskGroupCode?: string;
  }
): Promise<ActivityItem[]> {
  const billingItems = await getClientActivity(accessToken, clientCode, detail, ledgerEntries);
  const taskGroupCode = options?.taskGroupCode ?? taskCodeForBillingClient(detail);
  return mergeTaskTimelineItems(clientCode, billingItems, {
    ...options,
    taskGroupCode,
    clientContext: {
      code: detail.code,
      name: detail.name,
      caseTitle: detail.caseTitle
    }
  });
}
