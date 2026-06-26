import type { BillingHistoryItem } from "@/lib/sheets/billing-history";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";

function blob(...parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Italic note for task & event history rows (deleted, cancelled, removed, edited). */
export function taskActivityModificationNote(entry: TaskActivityEntry): string | null {
  const action = entry.action.trim().toLowerCase();
  const text = blob(entry.summary, entry.details);

  if (action === "edit") return "Edited";
  if (text.includes("delete") || text.includes("deleted")) return "Deleted";
  if (text.includes("cancel")) return "Cancelled";
  if (text.includes("removed") || text.includes("remove")) return "Removed";
  return null;
}

/** Italic note for billing & document history rows. */
export function billingHistoryModificationNote(item: BillingHistoryItem): string | null {
  if (item.kind === "void") return "Voided";
  if (item.kind === "edit") return "Edited";

  const text = blob(item.title, item.subtitle, item.status);
  if (text.includes("delete") || text.includes("deleted")) return "Deleted";
  if (text.includes("cancel")) return "Cancelled";
  if (text.includes("removed") || text.includes("remove")) return "Removed";
  if (text.includes("edit") || text.includes("edited")) return "Edited";
  return null;
}

/** Italic note for merged client activity timeline staff-action rows. */
export function activityItemModificationNote(item: {
  kind: string;
  title?: string;
  subtitle?: string;
  status?: string;
}): string | null {
  if (item.kind !== "task-action") return null;

  const action = (item.status || "").trim().toLowerCase();
  const text = blob(item.title, item.subtitle, item.status);

  if (action === "edit" || text.includes("edited")) return "Edited";
  if (text.includes("delete") || text.includes("deleted")) return "Deleted";
  if (text.includes("cancel")) return "Cancelled";
  if (text.includes("removed") || text.includes("remove")) return "Removed";
  return null;
}
