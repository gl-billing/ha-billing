import type { ItemSummary } from "@/components/office-tasks/ItemCard";

/** Optional filing / follow-up actions for task and event rows. */
export type WorkItemFilingActionProps = {
  onMarkSubmitted?: (item: ItemSummary) => void;
  onConfirmParentFiled?: (item: ItemSummary, parentEvent: ItemSummary) => void;
};
