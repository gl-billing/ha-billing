import type { WalkInClient } from "@/lib/gl-config";
import { formatClientCaseLabel } from "@/lib/gl-config";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";

export async function runWalkInPromoteAutomations(
  accessToken: string,
  walkIn: WalkInClient,
  clientCase: string,
  _assignee: string,
  actor: string
): Promise<{ timelineNote: boolean }> {
  let timelineNote = false;

  const notes = walkIn.notes?.trim();
  if (notes) {
    await appendTaskActivity(accessToken, {
      user: actor,
      action: "walkin.promote",
      source: "Task",
      clientCase,
      summary: `Walk-in ${walkIn.walkInId} visit notes`,
      details: notes
    });
    timelineNote = true;
  }

  return { timelineNote };
}

export function walkInClientCaseLabel(walkIn: WalkInClient, clientName: string, caseTitle: string): string {
  return formatClientCaseLabel(clientName || walkIn.name, caseTitle || walkIn.matter);
}
