import {
  mutateJsonWithOfflineQueue,
  type OfflineQueuedResult
} from "@/lib/fetch-json";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";

type MutationResult<T> = { ok: boolean; status: number; data: T } | OfflineQueuedResult;

function itemPayload(item: ItemSummary) {
  return {
    source: item.source,
    rowNumber: item.rowNumber,
    id: item.id
  };
}

export async function mutateTaskComplete(
  item: ItemSummary,
  done: boolean
): Promise<MutationResult<{ message?: string; error?: string }>> {
  return mutateJsonWithOfflineQueue("/api/tasks/items/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...itemPayload(item), done }),
    offlineLabel: done ? "Mark task done" : "Reopen task"
  });
}

export async function mutateTaskStatus(
  item: ItemSummary,
  status: ItemStatusUpdate,
  note?: string
): Promise<MutationResult<{ message?: string; error?: string; status?: string; remarks?: string }>> {
  return mutateJsonWithOfflineQueue("/api/tasks/items/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...itemPayload(item), status, note }),
    offlineLabel: "Update task status"
  });
}

export async function mutateTaskNextAction(
  item: ItemSummary,
  nextAction: string
): Promise<MutationResult<{ message?: string; error?: string }>> {
  return mutateJsonWithOfflineQueue("/api/tasks/items/next-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...itemPayload(item), nextAction }),
    offlineLabel: "Save next action"
  });
}

export function isOfflineQueued<T>(
  result: MutationResult<T>
): result is OfflineQueuedResult {
  return "queued" in result && result.queued === true;
}
