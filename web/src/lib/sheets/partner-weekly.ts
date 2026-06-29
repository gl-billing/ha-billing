import { formatPeso } from "@/lib/gl-config";
import { getAllMasterRows, dashboardFromMasterRows } from "@/lib/sheets/master";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { computeEmployeeStats } from "@/lib/office-tasks/schedule";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { getEscalationCandidates, getAndreaCourtConfirmationItems } from "@/lib/hearing-escalation";
import { getWeekDates } from "@/lib/office-tasks/schedule";

export type PartnerWeeklyReport = {
  weekLabel: string;
  generatedAt: string;
  billing: {
    overdueClients: number;
    totalOverdueBalance: number;
    newClientsThisWeek: number;
    collectionsThisWeek: number;
  };
  tasks: {
    overdueOpen: number;
    completedThisWeek: number;
    hearingsThisWeek: number;
    escalationDue: number;
    courtConfirmationPending: number;
  };
  employees: Array<{
    name: string;
    openTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
  }>;
};

function weekStartYmd(todayYmd: string): string {
  const d = new Date(`${todayYmd}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function inWeek(dateYmd: string | null, start: string, end: string): boolean {
  if (!dateYmd) return false;
  return dateYmd >= start && dateYmd <= end;
}

export async function buildPartnerWeeklyReport(accessToken: string, todayYmd: string): Promise<PartnerWeeklyReport> {
  const weekStart = weekStartYmd(todayYmd);
  const weekEnd = todayYmd;
  const master = await getAllMasterRows(accessToken);
  const dashboard = dashboardFromMasterRows(master);
  const items = await collectAllItems(accessToken);
  const directory = await getEmployeeDirectory(accessToken);
  const weekDates = getWeekDates(weekStart);
  const employeeStats = computeEmployeeStats(
    items,
    directory.map((e) => e.name),
    todayYmd,
    weekDates
  );

  let newClientsThisWeek = 0;
  for (const row of master) {
    const closed = String(row[25] || "").trim();
    if (closed && inWeek(closed.slice(0, 10), weekStart, weekEnd)) {
      /* closed date — skip */
    }
  }

  const completedThisWeek = items.filter(
    (item) => item.done && inWeek(item.completedDate, weekStart, weekEnd)
  ).length;

  const hearingsThisWeek = items.filter(
    (item) =>
      item.source === "Event" &&
      /hearing/i.test(item.category) &&
      inWeek(item.eventDate || item.date, weekStart, weekEnd)
  ).length;

  let collectionsThisWeek = 0;
  for (const row of master) {
    const lastBilling = String(row[7] || "").slice(0, 10);
    const payments = Number(row[10]) || 0;
    if (lastBilling && inWeek(lastBilling, weekStart, weekEnd)) {
      collectionsThisWeek += payments > 0 ? payments : 0;
    }
  }

  return {
    weekLabel: `${weekStart} – ${weekEnd}`,
    generatedAt: new Date().toISOString(),
    billing: {
      overdueClients: dashboard.overdueClients,
      totalOverdueBalance: dashboard.totalCollectibles,
      newClientsThisWeek,
      collectionsThisWeek
    },
    tasks: {
      overdueOpen: items.filter((i) => !i.done && i.status.toLowerCase() === "overdue").length,
      completedThisWeek,
      hearingsThisWeek,
      escalationDue: getEscalationCandidates(items, todayYmd, 2).length,
      courtConfirmationPending: getAndreaCourtConfirmationItems(items).length
    },
    employees: employeeStats.map((e) => ({
      name: e.name,
      openTasks: e.open,
      overdueTasks: e.overdue,
      completedThisWeek: e.done
    }))
  };
}

export function formatPartnerWeeklyReportHtml(report: PartnerWeeklyReport): string {
  const employeeRows = report.employees
    .map(
      (e) =>
        `<tr><td style="padding:6px;border-bottom:1px solid #eee;">${e.name}</td>` +
        `<td style="padding:6px;border-bottom:1px solid #eee;">${e.openTasks}</td>` +
        `<td style="padding:6px;border-bottom:1px solid #eee;">${e.overdueTasks}</td>` +
        `<td style="padding:6px;border-bottom:1px solid #eee;">${e.completedThisWeek}</td></tr>`
    )
    .join("");

  return (
    `<h2>Weekly partner report — ${report.weekLabel}</h2>` +
    `<h3>Billing</h3><ul>` +
    `<li>Overdue clients: ${report.billing.overdueClients} (${formatPeso(report.billing.totalOverdueBalance)})</li>` +
    `<li>Collections this week: ${formatPeso(report.billing.collectionsThisWeek)}</li>` +
    `</ul>` +
    `<h3>Tasks & hearings</h3><ul>` +
    `<li>Open overdue: ${report.tasks.overdueOpen}</li>` +
    `<li>Completed this week: ${report.tasks.completedThisWeek}</li>` +
    `<li>Hearings this week: ${report.tasks.hearingsThisWeek}</li>` +
    `<li>Due within 48h (escalation): ${report.tasks.escalationDue}</li>` +
    `<li>Court confirmation pending (secretaries): ${report.tasks.courtConfirmationPending}</li>` +
    `</ul>` +
    `<h3>Team workload</h3>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px;">` +
    `<thead><tr><th align="left">Staff</th><th align="left">Open</th><th align="left">Overdue</th><th align="left">Done this week</th></tr></thead>` +
    `<tbody>${employeeRows}</tbody></table>`
  );
}
