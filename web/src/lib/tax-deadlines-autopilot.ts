import { buildTaxDeadlineViews, buildTaxEventPayload, TAX_DEADLINE_DEFS } from "@/lib/tax-deadlines";
import { appendEvent } from "@/lib/office-tasks/sheets/tasks";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { defaultTaxComplianceAssignee } from "@/lib/office-tasks/task-assignees";

const AUTOPILOT_PREFIX = "BIR_AUTOPILOT";

export function birAutopilotMarker(form: string, filingDate: string): string {
  return `${AUTOPILOT_PREFIX}:${form}:${filingDate}`;
}

function eventHasMarker(items: { remarks: string; details: string }[], marker: string): boolean {
  return items.some(
    (item) => item.remarks.includes(marker) || item.details.includes(marker)
  );
}

export type BirAutopilotResult = {
  created: number;
  skipped: number;
  forms: string[];
};

/** Seed upcoming BIR filing deadlines as events (deduped by marker in remarks). */
export async function seedUpcomingBirDeadlines(
  accessToken: string,
  options?: { responsible?: string; horizonDays?: number }
): Promise<BirAutopilotResult> {
  const roster = await getActiveEmployeeNames(accessToken);
  const responsible = options?.responsible?.trim() || defaultTaxComplianceAssignee(roster);
  const horizonDays = options?.horizonDays ?? 120;
  const anchor = new Date();
  const horizon = new Date(anchor);
  horizon.setDate(horizon.getDate() + horizonDays);

  const views = buildTaxDeadlineViews(anchor);
  const existing = await collectAllItems(accessToken);
  const existingEvents: Array<{ remarks: string; details: string }> = existing
    .filter((item) => item.source === "Event")
    .map((item) => ({ remarks: item.remarks, details: item.details }));

  let created = 0;
  let skipped = 0;
  const forms: string[] = [];

  for (const view of views) {
    if (!view.nextDate) continue;
    const filing = new Date(`${view.nextDate}T12:00:00`);
    if (filing.getTime() > horizon.getTime()) continue;

    const marker = birAutopilotMarker(view.form, view.nextDate);
    if (eventHasMarker(existingEvents, marker)) {
      skipped++;
      continue;
    }

    const payload = buildTaxEventPayload(view.index, {
      filingDate: view.nextDate,
      clientCase: "Tax Compliance",
      responsible,
      priority: view.group === "Annual" ? "High" : "Medium",
      reminderDays: 3,
      calendarSync: false
    });

    await appendEvent(accessToken, {
      ...payload,
      remarks: `${payload.remarks}\n${marker}`
    });
    created++;
    forms.push(`${view.form} · ${view.nextDate}`);
    existingEvents.push({ remarks: marker, details: payload.details });
  }

  if (created) invalidateTasksDataCache(accessToken);
  return { created, skipped, forms };
}

export function listAutopilotForms(): string[] {
  return TAX_DEADLINE_DEFS.map((def) => def.form);
}
