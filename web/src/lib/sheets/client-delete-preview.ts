import type { ClientDetail } from "@/lib/gl-config";
import {
  groupItemsByClientCode,
  matterClientContextFromDetail,
  taskCodeForBillingClient
} from "@/lib/office-tasks/client-matter";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isItemOpen } from "@/lib/office-tasks/schedule";

export type ClientDeletePreviewItem = {
  id: string;
  source: "Task" | "Event";
  clientCase: string;
  title: string;
  date: string;
  status: string;
  assignee: string;
};

export type ClientDeletePreview = {
  balance: number;
  pendingArCount: number;
  openTasks: ClientDeletePreviewItem[];
  openEvents: ClientDeletePreviewItem[];
  openTaskCount: number;
  openEventCount: number;
};

function toPreviewItem(item: OfficeItem): ClientDeletePreviewItem {
  const isEvent = item.source === "Event";
  return {
    id: item.id,
    source: item.source,
    clientCase: item.clientCase,
    title: item.details?.trim() || (isEvent ? item.category || "Hearing / event" : item.category || "Task"),
    date: item.date || "",
    status: item.status || (item.done ? "Done" : "Open"),
    assignee: item.assignedTo || ""
  };
}

export function getOpenOfficeItemsForClient(
  client: ClientDetail,
  taskItems: OfficeItem[]
): OfficeItem[] {
  const taskCode = taskCodeForBillingClient(client);
  const grouped = groupItemsByClientCode(
    taskItems,
    client.code,
    taskCode,
    matterClientContextFromDetail(client)
  );
  return [...grouped.tasks, ...grouped.events].filter(isItemOpen);
}

export function buildClientDeletePreview(
  client: ClientDetail,
  taskItems: OfficeItem[],
  pendingArCount: number
): ClientDeletePreview {
  const openItems = getOpenOfficeItemsForClient(client, taskItems);
  const openTasks = openItems.filter((item) => item.source === "Task").map(toPreviewItem);
  const openEvents = openItems.filter((item) => item.source === "Event").map(toPreviewItem);

  return {
    balance: Number(client.balance) || 0,
    pendingArCount,
    openTasks,
    openEvents,
    openTaskCount: openTasks.length,
    openEventCount: openEvents.length
  };
}
