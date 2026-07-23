import "server-only";

import { DEFAULT_FIELD_DISPATCH_STAFF } from "@/lib/gl-config";
import { clientCodeFromCase } from "@/lib/office-tasks/client-matter";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import { applyFollowUpMarker } from "@/lib/office-tasks/follow-up-marker";
import {
  fieldDispatchLinkMarker,
  letterDraftMarker,
  letterServeMarker,
  linkedDraftTaskMarker,
  linkedServeTaskMarker
} from "@/lib/office-tasks/letter-item-links";
import {
  formatLetterDraftDescription,
  formatLetterServeDescription,
  isOutsideDavaoFieldDispatch,
  type LetterCorrespondenceInput
} from "@/lib/office-tasks/letter-task-utils";
import { resolveJasAssignee } from "@/lib/office-tasks/task-assignees";
import { LETTER_CORRESPONDENCE_FORM_TYPE } from "@/lib/office-tasks/task-form-utils";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { appendTask, type TaskFormInput } from "@/lib/office-tasks/sheets/tasks";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { createFieldDispatch, markFieldDispatchPrepaidOnCreate } from "@/lib/sheets/field-dispatch";
import { SHEETS } from "@/lib/tasks-config";
import { invalidateBillingReadCaches, invalidateCache } from "@/lib/sheets/cache";
import { postLetterCorrespondenceBilling } from "@/lib/office-tasks/letter-billing-server";
import { resolveEventLedgerBillingCode } from "@/lib/event-ledger-charge-server";

export type LetterCorrespondenceCreateResult = {
  draftTaskId: string;
  sheetRow: number;
  serveTaskId?: string;
  fieldDispatchId?: string;
  message: string;
};

const TASK_REMARKS_COL = "N";

async function patchTaskRemarks(
  accessToken: string,
  rowNumber: number,
  remarks: string
): Promise<void> {
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  await batchUpdateSheetValues(accessToken, [
    {
      range: toA1Range(SHEETS.tasks, `${TASK_REMARKS_COL}${rowNumber}`),
      values: [[remarks]]
    },
    {
      range: toA1Range(SHEETS.tasks, `R${rowNumber}`),
      values: [[now]]
    }
  ]);
}

export async function createLetterCorrespondenceTasks(
  accessToken: string,
  form: TaskFormInput,
  letter: LetterCorrespondenceInput,
  createdBy: string
): Promise<LetterCorrespondenceCreateResult> {
  const recipient = letter.recipient.trim();
  const draftDescription = formatLetterDraftDescription(
    letter.letterType,
    recipient,
    letter.letterTypeOther
  );

  if (letter.billThis) {
    const amount = Number(letter.billAmount) || 0;
    if (amount <= 0) throw new Error("Enter a valid billing amount.");
    const billingCode = await resolveEventLedgerBillingCode(accessToken, {
      clientCase: form.clientCase
    });
    if (!billingCode.code) {
      throw new Error("Select a billing client file (not walk-in only) before billing this letter.");
    }
  }

  let draftRemarks = appendRemarkMarkers(form.remarks || "", [letterDraftMarker()]);
  const draft = await appendTask(
    accessToken,
    {
      ...form,
      taskType: LETTER_CORRESPONDENCE_FORM_TYPE,
      description: draftDescription,
      status: form.status || "In Progress"
    },
    { createdBy }
  );

  const billingParts: string[] = [];
  if (letter.billThis) {
    const billing = await postLetterCorrespondenceBilling(accessToken, {
      clientCase: form.clientCase,
      letter,
      taskId: draft.id,
      auditUser: createdBy
    });
    if (billing.marker) {
      draftRemarks = appendRemarkMarkers(draftRemarks, [billing.marker]);
      await patchTaskRemarks(accessToken, draft.sheetRow, draftRemarks);
    }
    if (!billing.posted) {
      throw new Error(
        billing.message ||
          "Could not post letter billing to the client ledger. Open the matter billing tab and add the charge manually."
      );
    }
    if (billing.message) billingParts.push(billing.message);
    if (billing.clientCode) {
      invalidateBillingReadCaches(accessToken);
      invalidateCache(accessToken, `profile:${billing.clientCode}`);
    }
  }

  if (!letter.serveViaLiaison) {
    return {
      draftTaskId: draft.id,
      sheetRow: draft.sheetRow,
      message: [`Draft letter task added (${draft.id})`, ...billingParts].filter(Boolean).join(". ") + "."
    };
  }

  const roster = await getActiveEmployeeNames(accessToken);
  const liaison = resolveJasAssignee(roster);
  const serveLocation = String(letter.serveLocation || "Davao City").trim();
  const outsideDavao = isOutsideDavaoFieldDispatch(serveLocation);
  const clientCode = clientCodeFromCase(form.clientCase).toUpperCase();

  let fieldDispatchId: string | undefined;
  if (outsideDavao) {
    const fd = await createFieldDispatch(
      accessToken,
      {
        date: letter.serveByDate?.trim() || form.dueDate,
        location: serveLocation,
        staff: DEFAULT_FIELD_DISPATCH_STAFF,
        clientCode,
        purpose: "Serve demand letter",
        advanceGiven: letter.advanceGiven ?? 0,
        serviceFee: letter.serviceFee ?? 0,
        notes: `Auto from letter task ${draft.id} — ${draftDescription}`
      },
      createdBy
    );
    fieldDispatchId = fd.dispatchId;
    if (letter.servicePaid) {
      await markFieldDispatchPrepaidOnCreate(accessToken, fd.dispatchId, {
        advanceGiven: letter.advanceGiven ?? 0,
        serviceFee: letter.serviceFee ?? 0
      });
      invalidateCache(accessToken, "field-dispatch");
    }
  }

  const serveDescription = formatLetterServeDescription(
    letter.letterType,
    recipient,
    letter.letterTypeOther
  );
  let serveRemarks = appendRemarkMarkers("", [
    letterServeMarker(),
    linkedDraftTaskMarker(draft.id)
  ]);
  if (fieldDispatchId) {
    serveRemarks = appendRemarkMarkers(serveRemarks, [fieldDispatchLinkMarker(fieldDispatchId)]);
  }
  serveRemarks = applyFollowUpMarker(serveRemarks, "Waiting");

  const serve = await appendTask(
    accessToken,
    {
      clientCase: form.clientCase,
      assignedTo: liaison,
      dueDate: letter.serveByDate?.trim() || form.dueDate,
      dueTime: "",
      venue: letter.serveAddress?.trim() || "",
      priority: form.priority || "Medium",
      taskType: "Task",
      description: serveDescription,
      previousAction: "",
      nextAction: "Waiting until draft letter is ready to serve.",
      remarks: serveRemarks,
      status: "Waiting",
      reminderDays: form.reminderDays ?? 1,
      calendarSync: false
    },
    { createdBy }
  );

  const draftLinkMarkers = [linkedServeTaskMarker(serve.id)];
  if (fieldDispatchId) {
    draftLinkMarkers.push(fieldDispatchLinkMarker(fieldDispatchId));
  }
  draftRemarks = appendRemarkMarkers(draftRemarks, draftLinkMarkers);
  await patchTaskRemarks(accessToken, draft.sheetRow, draftRemarks);

  const parts = [
    `Draft letter task added (${draft.id})`,
    `Serve task for ${liaison.split(/\s+/)[0] || liaison} (${serve.id}) — Waiting until doc is ready`
  ];
  if (fieldDispatchId) {
    parts.push(
      letter.servicePaid
        ? `Field dispatch ${fieldDispatchId} created for ${serveLocation} (marked paid)`
        : `Field dispatch ${fieldDispatchId} created for ${serveLocation}`
    );
  }
  parts.push(...billingParts);

  return {
    draftTaskId: draft.id,
    sheetRow: draft.sheetRow,
    serveTaskId: serve.id,
    fieldDispatchId,
    message: `${parts.join(". ")}.`
  };
}
