"use client";

import { DeskChecklistView } from "@/components/office-tasks/DeskChecklistView";
import type { TasksDeskChecklistTabProps } from "@/components/office-tasks/tasks-app-types";

export function TasksDeskChecklistTab({
  data,
  deskChecklistItems,
  items,
  sessionStaffName,
  togglingKey,
  toggleItemDone,
  markPrepDone,
  markLetterDocDone,
  updateItemStatus,
  resetItemWithDate,
  deleteItem,
  updateItemNextAction,
  logAppearanceOutcome,
  togglePrepChecklistItem,
  mutatePrepChecklistItem,
  createEventPrepChecklist,
  initializePrepChecklist,
  prepChecklistCreatingKey,
  saveItemEdit,
  billingAccess,
  markCourtConfirmed,
  markEventSubmitted,
  confirmParentFiled,
  opts,
  viewerPrepRole,
  navProfile,
  deskChecklistScope,
  isAdmin,
  testLab,
  trialWorkspace
}: TasksDeskChecklistTabProps) {
  return (
    <DeskChecklistView
      items={deskChecklistItems}
      allItems={items}
      staffName={sessionStaffName || ""}
      togglingKey={togglingKey}
      onToggleDone={toggleItemDone}
      onMarkPrepDone={markPrepDone}
      onMarkLetterDocDone={markLetterDocDone}
      onSetStatus={updateItemStatus}
      onResetWithDate={resetItemWithDate}
      onDeleteItem={isAdmin ? deleteItem : undefined}
      onUpdateNextAction={updateItemNextAction}
      onLogAppearanceOutcome={logAppearanceOutcome}
      onTogglePrepChecklistItem={togglePrepChecklistItem}
      onMutatePrepChecklistItem={mutatePrepChecklistItem}
      onCreatePrepChecklist={createEventPrepChecklist}
      onInitializePrepChecklist={initializePrepChecklist}
      prepChecklistCreatingKey={prepChecklistCreatingKey}
      onSaveEdit={saveItemEdit}
      billingAccess={billingAccess}
      onCourtConfirmed={markCourtConfirmed}
      onMarkSubmitted={markEventSubmitted}
      onConfirmParentFiled={confirmParentFiled}
      formOptions={opts}
      viewerStaffName={sessionStaffName || undefined}
      viewerPrepRole={viewerPrepRole}
      roster={data.employees ?? []}
      testLab={testLab}
      trialWorkspace={trialWorkspace}
      navProfile={navProfile === "tasks-only" ? "tasks-only" : navProfile === "secretary" ? "secretary" : "full"}
      checklistScope={deskChecklistScope}
      isAdmin={isAdmin}
    />
  );
}
