import "server-only";

import { computePostHearingWarnings } from "@/lib/matter-automation";
import {
  hasPostHearingOutcomeWarningSentForDate,
  postHearingOutcomeWarningSentMarker
} from "@/lib/office-tasks/event-item-links";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { appendEventSheetRemarkMarkers } from "@/lib/office-tasks/sheets/event-remark-markers";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function sendPostHearingOutcomeWarnings(accessToken: string): Promise<{ sent: number; message: string }> {
  const today = todayYmd();
  const items = await collectAllItems(accessToken);
  const events = items.filter((item) => item.source === "Event");
  const warnings = computePostHearingWarnings(events, today, items).filter((warning) => {
    const event = events.find((row) => row.id === warning.itemId);
    if (!event) return false;
    return !hasPostHearingOutcomeWarningSentForDate(event.remarks || "", event.id, today);
  });

  const directory = await getEmployeeDirectory(accessToken);
  const emailByName = new Map(
    directory.map((employee) => [employee.name.trim().toLowerCase(), employee.email.trim().toLowerCase()])
  );

  const byAssignee = new Map<string, typeof warnings>();
  for (const warning of warnings) {
    const key = warning.assignee.toLowerCase();
    const list = byAssignee.get(key) || [];
    list.push(warning);
    byAssignee.set(key, list);
  }

  let sent = 0;
  for (const [assignee, list] of byAssignee) {
    const email = emailByName.get(assignee);
    if (!email) continue;
    const rows = list
      .map(
        (warning) =>
          `<li><strong>${warning.clientCase}</strong> — ${warning.hearingDate}: ${warning.message}</li>`
      )
      .join("");
    for (const warning of list) {
      const event = events.find((row) => row.id === warning.itemId);
      if (!event) continue;
      await appendEventSheetRemarkMarkers(accessToken, event, [
        postHearingOutcomeWarningSentMarker(event.id, today)
      ]);
    }

    try {
      await sendHtmlEmailViaGmail({
        accessToken,
        to: email,
        subject: `Hearing outcome needed — ${list.length} matter${list.length === 1 ? "" : "s"}`,
        html: `<p>Please log results for these past hearings:</p><ul>${rows}</ul>`,
        plain: list.map((w) => `${w.clientCase} (${w.hearingDate}): ${w.message}`).join("\n")
      });
      sent += 1;
    } catch {
      /* markers written — skip duplicate on retry */
    }
  }

  if (sent > 0) {
    invalidateTasksDataCache(accessToken);
  }

  return {
    sent,
    message: sent ? `Sent ${sent} post-hearing warning email(s).` : "No post-hearing warnings needed."
  };
}
