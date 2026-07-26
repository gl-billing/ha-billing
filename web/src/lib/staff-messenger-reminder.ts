import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { SavedTasksTab } from "@/lib/staff-prefs";
import { tasksHref } from "@/lib/tasks-routes";
import { scopeLabel, type ReminderScope } from "@/lib/office-tasks/reminders";
import { whatsAppShareUrl } from "@/lib/messenger-share";

const DEFAULT_APP_ROOT =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://ha-billing.vercel.app";

/** Normalize PH mobile numbers to digits for wa.me links. */
export function normalizeStaffPhoneE164(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("63") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `63${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export function absoluteTasksAppUrl(tab: SavedTasksTab = "desk-checklist"): string {
  const path = tasksHref({ tab });
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const root =
    (typeof window !== "undefined" ? window.location.origin : "") || DEFAULT_APP_ROOT;
  return `${root.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function staffPhoneForReminders(
  employee: Pick<EmployeeRecord, "email" | "name" | "role"> & { phone?: string }
): string {
  return String(employee.phone || "").trim();
}

export function buildStaffMessengerReminderMessage(input: {
  assignee: string;
  dueToday: number;
  overdue: number;
  scope: ReminderScope;
  appUrl?: string;
  tab?: SavedTasksTab;
}): string {
  const appUrl = input.appUrl || absoluteTasksAppUrl(input.tab ?? "desk-checklist");
  const firstName = input.assignee.trim().split(/\s+/)[0] || input.assignee.trim() || "there";
  const lines = [
    `Hi ${firstName},`,
    "",
    `Desk reminder (${scopeLabel(input.scope)}):`,
    `• Due today: ${input.dueToday}`,
    `• Overdue: ${input.overdue}`,
    "",
    `Open HA Office: ${appUrl}`
  ];
  return lines.join("\n");
}

export function staffReminderWhatsAppUrl(message: string, phone: string): string | null {
  const digits = normalizeStaffPhoneE164(phone);
  if (!digits) return null;
  return whatsAppShareUrl(message, digits);
}
