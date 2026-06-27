import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isDeadlineLike } from "@/lib/office-tasks/schedule";

const COURT_CONFIRMED_MARKER = "GL_COURT_CONFIRMED";

export function markCourtConfirmed(remarks: string): string {
  const base = String(remarks || "").replace(/GL_COURT_CONFIRMED/g, "").trim();
  return base ? `${base} ${COURT_CONFIRMED_MARKER}` : COURT_CONFIRMED_MARKER;
}

export function isCourtConfirmed(remarks: string): boolean {
  return String(remarks || "").includes(COURT_CONFIRMED_MARKER);
}

export function isHearingItem(item: OfficeItem): boolean {
  return item.source === "Event" && /hearing/i.test(item.category || "");
}

export function isHearingPendingCourtConfirmation(item: OfficeItem): boolean {
  if (!isHearingItem(item) || item.done) return false;
  if (isCourtConfirmed(item.remarks)) return false;
  const status = item.status.trim().toLowerCase();
  return status === "scheduled" || status === "in progress" || /pending/i.test(item.nextAction);
}

function daysUntil(dateYmd: string | null, todayYmd: string): number | null {
  if (!dateYmd) return null;
  const target = new Date(`${dateYmd}T12:00:00`);
  const today = new Date(`${todayYmd}T12:00:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Hearings / filing deadlines within the next N days (default 48h ≈ 2 days). */
export function getEscalationCandidates(
  items: OfficeItem[],
  todayYmd: string,
  withinDays = 2
): OfficeItem[] {
  return items
    .filter((item) => !item.done)
    .filter((item) => {
      const days = daysUntil(item.date, todayYmd);
      if (days === null) return false;
      return days >= 0 && days <= withinDays;
    })
    .filter((item) => item.source === "Event" && (isHearingItem(item) || isDeadlineLike(item)))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export function getAndreaCourtConfirmationItems(items: OfficeItem[]): OfficeItem[] {
  return items
    .filter(isHearingPendingCourtConfirmation)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}

export function resolveAndreaEmail(directory: EmployeeRecord[]): string | null {
  return resolveAndreaEmployee(directory)?.email.trim().toLowerCase() || null;
}

export function resolveAndreaEmployee(directory: EmployeeRecord[]): EmployeeRecord | null {
  const fromEnv =
    process.env.SECRETARY_EMAIL?.trim().toLowerCase() ||
    process.env.ANDREA_EMAIL?.trim().toLowerCase();
  if (fromEnv) {
    const match = directory.find((employee) => employee.email.trim().toLowerCase() === fromEnv);
    if (match) return match;
  }

  for (const employee of directory) {
    const name = employee.name.toLowerCase();
    const role = employee.role.toLowerCase();
    if (
      name.includes("shiela") ||
      name.includes("andrea") ||
      role.includes("secretary") ||
      role.includes("court") ||
      role.includes("liaison")
    ) {
      return employee;
    }
  }

  for (const employee of directory) {
    if (employee.name.toLowerCase().includes("ellyza")) {
      return employee;
    }
  }

  return null;
}

export function formatAssigneeOverdueEmailHtml(
  assigneeName: string,
  overdueItems: OfficeItem[]
): string {
  if (!overdueItems.length) return "";

  const rows = overdueItems
    .map((item) => {
      const title = item.details?.trim() || item.clientCase || item.id || "Task";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${item.date || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${item.clientCase || item.id}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${title}</td>
        <td style="padding:8px;border-bottom:1px solid #fecaca;">${item.status || "Open"}</td>
      </tr>`;
    })
    .join("");

  return (
    `<div style="margin:0 0 20px;padding:16px;border:2px solid #b91c1c;border-radius:12px;background:#fef2f2;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#b91c1c;">Fix first — overdue</p>` +
    `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#1a1612;">` +
    `<strong>${assigneeName}</strong>, clear these ${overdueItems.length} overdue item${overdueItems.length === 1 ? "" : "s"} before new court calls or today&apos;s tasks.` +
    `</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:13px;">` +
    `<thead><tr>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #b91c1c;">Due</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #b91c1c;">Client / case</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #b91c1c;">Task</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #b91c1c;">Status</th>` +
    `</tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

export function formatCourtConfirmationEmailHtml(items: OfficeItem[]): string {
  const rows = items
    .map((item) => {
      const court = item.venue?.trim() || "Court not specified";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.date || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.clientCase || item.id}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${court}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.startTime || "—"}</td>
      </tr>`;
    })
    .join("");

  return (
    `<p>Please call each court below to confirm the scheduled hearing date and time.</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px;">` +
    `<thead><tr>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #333;">Date</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #333;">Client / case</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #333;">Court / venue</th>` +
    `<th align="left" style="padding:8px;border-bottom:2px solid #333;">Time</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}

export function formatEscalationEmailHtml(items: OfficeItem[], withinDays: number): string {
  const rows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.source}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.date || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.clientCase || item.id}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.category} · ${item.status}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.assignedTo || "—"}</td>
        </tr>`
    )
    .join("");

  return (
    `<p>The following hearings and filing deadlines are due within ${withinDays} day(s):</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px;">` +
    `<thead><tr>` +
    `<th align="left">Type</th><th align="left">Date</th><th align="left">Matter</th>` +
    `<th align="left">Details</th><th align="left">Assignee</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`
  );
}
