import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { DeskChecklistScope } from "@/lib/office-tasks/desk-checklist";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { NavUserProfile } from "@/lib/workspace-labels";
import type { TasksHomeData } from "@/lib/office-tasks/home-data";

export type TasksDeskChecklistTabProps = {
  data: TasksHomeData;
  deskChecklistItems: OfficeItem[];
  items: OfficeItem[];
  sessionStaffName: string;
  togglingKey: string | null;
  toggleItemDone: (item: ItemSummary, done: boolean) => Promise<void>;
  markPrepDone: (item: ItemSummary) => Promise<void>;
  markLetterDocDone: (item: ItemSummary) => Promise<void>;
  updateItemStatus: (item: ItemSummary, update: ItemStatusUpdate, options?: ItemStatusOptions) => Promise<void>;
  resetItemWithDate: (item: ItemSummary, date: string) => Promise<void>;
  deleteItem: (item: ItemSummary) => Promise<void>;
  updateItemNextAction: (item: ItemSummary, nextAction: string) => Promise<void>;
  logAppearanceOutcome: (
    item: ItemSummary,
    payload: {
      action: "completed" | "rescheduled" | "postponed" | "cancelled";
      whatHappened: string;
      nextDate?: string;
      createNextDateFollowUp: boolean;
      courtFollowUpKind?: "none" | "next_hearing" | "submission" | "other";
      followUpDate?: string;
      followUpNote?: string;
    }
  ) => Promise<void>;
  togglePrepChecklistItem: (item: ItemSummary, itemIndex: number, checked: boolean) => Promise<void>;
  mutatePrepChecklistItem: (item: ItemSummary, mutation: PrepChecklistMutation) => Promise<void>;
  createEventPrepChecklist: (item: ItemSummary) => Promise<void>;
  initializePrepChecklist: (item: ItemSummary) => Promise<void>;
  prepChecklistCreatingKey: string | null;
  saveItemEdit: (item: EditableItem, payload: Record<string, unknown>) => Promise<void>;
  billingAccess: boolean;
  markCourtConfirmed: (item: ItemSummary) => Promise<void>;
  markEventSubmitted: (item: ItemSummary) => Promise<void>;
  confirmParentFiled: (task: ItemSummary, parentEvent: ItemSummary) => Promise<void>;
  opts: EntryFormOptions | undefined;
  viewerPrepRole: PrepWorkloadViewRole;
  navProfile: NavUserProfile;
  deskChecklistScope: DeskChecklistScope;
  isAdmin: boolean;
  testLab?: boolean;
  trialWorkspace?: boolean;
};
