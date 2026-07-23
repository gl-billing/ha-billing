import {
  hasLetterDraftMarker,
  parseDocDoneMarker,
  parseLinkedDraftTaskId,
  parseLinkedServeTaskId
} from "@/lib/office-tasks/letter-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

export function resolveServeTaskForLetterDraft(draft: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  const serveId = parseLinkedServeTaskId(draft.remarks || "");
  if (!serveId) return null;
  return items.find((item) => item.source === "Task" && item.id === serveId) || null;
}

export function resolveDraftTaskForLetterServe(serve: OfficeItem, items: OfficeItem[]): OfficeItem | null {
  const draftId = parseLinkedDraftTaskId(serve.remarks || "");
  if (!draftId) return null;
  return items.find((item) => item.source === "Task" && item.id === draftId) || null;
}

export function shouldShowLetterDocDone(task: OfficeItem, items: OfficeItem[]): boolean {
  if (task.source !== "Task" || task.done) return false;
  if (!hasLetterDraftMarker(task.remarks || "")) return false;
  if (parseDocDoneMarker(task.remarks || "")) return false;
  const serve = resolveServeTaskForLetterDraft(task, items);
  if (!serve || serve.done) return false;
  return serve.status.trim() === "Waiting";
}

export function shouldDeferLetterDraftCompletion(task: OfficeItem, items: OfficeItem[]): boolean {
  if (task.source !== "Task" || task.done) return false;
  if (!hasLetterDraftMarker(task.remarks || "")) return false;
  if (!parseDocDoneMarker(task.remarks || "")) return false;
  const serve = resolveServeTaskForLetterDraft(task, items);
  return Boolean(serve && !serve.done);
}

export function isDocDoneLetterDraftItem(task: Pick<OfficeItem, "source" | "done" | "remarks">): boolean {
  if (task.source !== "Task" || task.done) return false;
  if (!hasLetterDraftMarker(task.remarks || "")) return false;
  return Boolean(parseDocDoneMarker(task.remarks || ""));
}
