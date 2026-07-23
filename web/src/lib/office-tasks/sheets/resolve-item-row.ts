import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { findEventRowById, findTaskRowById } from "@/lib/office-tasks/sheets/row-verify";

export type ResolvedOfficeItemTarget = {
  rowNumber: number;
  itemId: string;
  item: OfficeItem | undefined;
};

export type OfficeItemMutationInput = {
  source?: string;
  rowNumber?: number;
  itemId?: string;
  id?: string;
};

/** Parse Task|Event mutation body — accepts itemId or legacy id field. */
export function parseOfficeItemMutationInput(
  body: OfficeItemMutationInput,
  options?: { eventOnly?: boolean; taskOnly?: boolean }
): { source: "Task" | "Event"; itemId: string; rowNumber: number } | { error: string } {
  const source =
    body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
  if (!source) {
    return { error: "source (Task|Event) is required." };
  }
  if (options?.eventOnly && source !== "Event") {
    return { error: "Event source is required." };
  }
  if (options?.taskOnly && source !== "Task") {
    return { error: "Task source is required." };
  }

  const itemId = String(body.itemId || body.id || "").trim();
  const rowNumber = Number(body.rowNumber);
  if (!itemId && (!rowNumber || rowNumber < 2)) {
    return { error: "itemId or rowNumber is required." };
  }

  return { source, itemId, rowNumber };
}

/** Resolve sheet row by ID (or trust rowNumber) and load the matching item. */
export async function resolveOfficeItemForMutation(
  accessToken: string,
  source: "Task" | "Event",
  options: { itemId?: string; rowNumber?: number }
): Promise<ResolvedOfficeItemTarget | null> {
  const itemId = options.itemId?.trim() || "";
  let rowNumber = Number(options.rowNumber) || 0;

  if (itemId) {
    const match =
      source === "Event"
        ? await findEventRowById(accessToken, itemId)
        : await findTaskRowById(accessToken, itemId);
    if (match) rowNumber = match.rowNumber;
  }

  if (!rowNumber || rowNumber < 2) return null;

  const items = await collectAllItems(accessToken);
  const item = itemId
    ? items.find((row) => row.source === source && row.id === itemId) ||
      items.find((row) => row.source === source && row.rowNumber === rowNumber)
    : items.find((row) => row.source === source && row.rowNumber === rowNumber);

  return {
    rowNumber,
    itemId: item?.id || itemId,
    item
  };
}
