import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isCancelledStatus } from "@/lib/office-tasks/schedule";

export type DeskChecklistRowOptions = {
  muted?: boolean;
  inactive?: boolean;
};

/** Map sheet item status to checklist row chrome (muted / strikethrough / inactive). */
export function deskChecklistRowState(item: OfficeItem): DeskChecklistRowOptions {
  const isCancelled = isCancelledStatus(item.status);
  const isDone = item.done || item.status === "Done" || item.status === "Submitted";

  if (isCancelled) {
    return { muted: true, inactive: true };
  }
  if (isDone) {
    return { muted: true };
  }
  return {};
}
