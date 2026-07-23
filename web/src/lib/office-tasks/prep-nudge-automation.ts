import "server-only";

import { hearingNeedsPrepNudge } from "@/lib/matter-automation";
import {
  hasPrepNudgeSentForDate,
  prepNudgeSentMarker
} from "@/lib/office-tasks/event-item-links";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { parsePrepChecklistState, prepChecklistProgress } from "@/lib/office-tasks/prep-checklist-storage";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { appendEventSheetRemarkMarkers } from "@/lib/office-tasks/sheets/event-remark-markers";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { readFirmAutomationSettings } from "@/lib/firm-automation-settings";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export type PrepNudgeCandidate = {
  event: OfficeItem;
  assigneeEmail: string;
  percent: number;
};

export function findPrepNudgeCandidates(
  items: OfficeItem[],
  withinDays: number,
  today = todayYmd()
): PrepNudgeCandidate[] {
  const candidates: PrepNudgeCandidate[] = [];

  for (const event of items) {
    if (!hearingNeedsPrepNudge(event, today, withinDays)) continue;
    if (hasPrepNudgeSentForDate(event.remarks || "", event.id, today)) continue;
    const state = parsePrepChecklistState(event.remarks || "");
    if (!state) continue;
    const { done, total } = prepChecklistProgress(state);
    const percent = total ? Math.round((done / total) * 100) : 0;
    const assignee = event.assignedTo?.trim();
    if (!assignee) continue;
    candidates.push({
      event,
      assigneeEmail: assignee,
      percent
    });
  }

  return candidates;
}

export async function sendPrepChecklistNudges(accessToken: string): Promise<{ sent: number; message: string }> {
  const settings = await readFirmAutomationSettings(accessToken);
  const today = todayYmd();
  const items = await collectAllItems(accessToken);
  const directory = await getEmployeeDirectory(accessToken);
  const emailByName = new Map(
    directory.map((employee) => [employee.name.trim().toLowerCase(), employee.email.trim().toLowerCase()])
  );

  const candidates = findPrepNudgeCandidates(items, settings.prepNudgeDaysBeforeHearing, today);
  let sent = 0;

  for (const candidate of candidates) {
    const email = emailByName.get(candidate.assigneeEmail.toLowerCase());
    if (!email) continue;
    const date = candidate.event.eventDate || candidate.event.date || "TBD";
    const subject = `Prep checklist — hearing ${date} (${candidate.percent}% done)`;
    const html =
      `<p><strong>${candidate.event.clientCase}</strong></p>` +
      `<p>Hearing on <strong>${date}</strong> is ${settings.prepNudgeDaysBeforeHearing} days away and prep is only <strong>${candidate.percent}%</strong> complete.</p>` +
      `<p>${candidate.event.details.trim().slice(0, 200)}</p>`;
    await appendEventSheetRemarkMarkers(accessToken, candidate.event, [
      prepNudgeSentMarker(candidate.event.id, today)
    ]);
    try {
      await sendHtmlEmailViaGmail({
        accessToken,
        to: email,
        subject,
        html,
        plain: `Prep ${candidate.percent}% for ${candidate.event.clientCase} hearing on ${date}.`
      });
      sent += 1;
    } catch {
      /* marker written — skip duplicate on retry; email failure logged by Gmail helper */
    }
  }

  if (sent > 0) {
    invalidateTasksDataCache(accessToken);
  }

  return {
    sent,
    message: sent ? `Sent ${sent} prep nudge(s).` : "No prep nudges needed."
  };
}
