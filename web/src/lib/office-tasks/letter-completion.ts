import "server-only";

import { FIRM_LINE } from "@/lib/billing-document-design";
import { FIRM_STAFF_LIAISON } from "@/lib/gl-config";
import { firmAppHref, getTasksAppUrl } from "@/lib/firm-apps";
import { appendRemarkMarkers } from "@/lib/office-tasks/event-item-links";
import { applyFollowUpWithNote, clearFollowUpMarker } from "@/lib/office-tasks/follow-up-marker";
import {
  clearDocDoneMarker,
  docDoneMarker,
  hasLetterDraftMarker
} from "@/lib/office-tasks/letter-item-links";
import { resolveDraftTaskForLetterServe, resolveServeTaskForLetterDraft } from "@/lib/office-tasks/letter-completion-core";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { batchUpdateSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { SHEETS } from "@/lib/tasks-config";
import { whatsAppShareUrl } from "@/lib/messenger-share";

export {
  hasLetterDraftMarker,
  parseDocDoneMarker,
  parseLinkedServeTaskId
} from "@/lib/office-tasks/letter-item-links";
export {
  resolveServeTaskForLetterDraft,
  shouldDeferLetterDraftCompletion,
  shouldShowLetterDocDone
} from "@/lib/office-tasks/letter-completion-core";

const TASK_COL = {
  nextAction: 10,
  status: 11,
  remarks: 14,
  lastUpdated: 18
};

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - r - 1) / 26);
  }
  return s;
}

function absoluteTasksAppUrl(tab = "today"): string {
  const base = firmAppHref("/app", getTasksAppUrl()) || "/app";
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    const origin = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
    return `${origin}${base}?tab=${encodeURIComponent(tab)}`;
  }
  return `${base}?tab=${encodeURIComponent(tab)}`;
}

/** Optional WhatsApp ping when liaison phone is configured via env. */
export function buildLetterDocReadyWhatsAppUrl(input: {
  liaisonName?: string;
  letterSummary: string;
  clientCase: string;
}): string | null {
  const raw = process.env.FIRM_LIAISON_WHATSAPP_PHONE?.trim() || "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const firstName = (input.liaisonName || FIRM_STAFF_LIAISON).trim().split(/\s+/)[0] || "Liaison";
  const appUrl = absoluteTasksAppUrl("today");
  const text = [
    `${FIRM_LINE} — office tasks`,
    "",
    `Hi ${firstName}, document ready to serve.`,
    "",
    input.letterSummary.trim(),
    input.clientCase.trim() ? `Matter: ${input.clientCase.trim()}` : "",
    "",
    `Open app: ${appUrl}`,
    "",
    "Thank you!"
  ]
    .filter((line) => line !== undefined)
    .join("\n");
  return whatsAppShareUrl(text, digits);
}

/** Mark draft ready and move linked serve task from Waiting to In Progress. */
export async function recordLetterDocReadyState(
  accessToken: string,
  draft: OfficeItem,
  completedBy: string
): Promise<{ ok: boolean; whatsAppUrl: string | null }> {
  if (draft.source !== "Task" || draft.rowNumber < 2 || !hasLetterDraftMarker(draft.remarks || "")) {
    return { ok: false, whatsAppUrl: null };
  }

  const items = await collectAllItems(accessToken);
  const serve = resolveServeTaskForLetterDraft(draft, items);
  if (!serve || serve.rowNumber < 2 || serve.done) {
    return { ok: false, whatsAppUrl: null };
  }

  const staff = completedBy.trim() || "staff";
  const dateYmd = todayYmd();
  const draftRemarks = appendRemarkMarkers(clearDocDoneMarker(draft.remarks || ""), [
    docDoneMarker(staff, dateYmd)
  ]);
  const draftNextAction = "Document ready — liaison serving.";
  const serveNextAction = "Serve the letter — document is ready.";
  const serveRemarks = applyFollowUpWithNote(
    clearFollowUpMarker(serve.remarks || ""),
    "Started",
    "Document ready to serve."
  );
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  await batchUpdateSheetValues(accessToken, [
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${draft.rowNumber}`),
      values: [[draftRemarks]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.nextAction)}${draft.rowNumber}`),
      values: [[draftNextAction]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${draft.rowNumber}`),
      values: [[now]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${serve.rowNumber}`),
      values: [[serveRemarks]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.nextAction)}${serve.rowNumber}`),
      values: [[serveNextAction]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.status)}${serve.rowNumber}`),
      values: [["In Progress"]]
    },
    {
      range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${serve.rowNumber}`),
      values: [[now]]
    }
  ]);

  const whatsAppUrl = buildLetterDocReadyWhatsAppUrl({
    liaisonName: serve.assignedTo,
    letterSummary: draft.details?.trim() || serve.details?.trim() || "Letter ready to serve",
    clientCase: draft.clientCase || ""
  });

  return { ok: true, whatsAppUrl };
}

/** When serve task is done, close linked letter draft. */
export async function closeLinkedLetterDraftWhenServeDone(
  accessToken: string,
  serveTask: OfficeItem
): Promise<number> {
  const items = await collectAllItems(accessToken);
  const draft = resolveDraftTaskForLetterServe(serveTask, items);
  if (!draft || draft.done || draft.rowNumber < 2) return 0;

  const remarks = clearDocDoneMarker(draft.remarks || "");
  if (remarks !== (draft.remarks || "")) {
    const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    await batchUpdateSheetValues(accessToken, [
      {
        range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.remarks)}${draft.rowNumber}`),
        values: [[remarks]]
      },
      {
        range: toA1Range(SHEETS.tasks, `${colLetter(TASK_COL.lastUpdated)}${draft.rowNumber}`),
        values: [[now]]
      }
    ]);
  }

  await setItemDone(accessToken, "Task", draft.rowNumber, true);
  return 1;
}
