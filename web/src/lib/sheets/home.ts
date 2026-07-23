import type { FollowUpClient, HomeDashboard } from "@/lib/gl-config";
import { resolveClientMatterType } from "@/lib/client-matter-type";
import { readFirmAlertRulesFromSettings } from "@/lib/firm-alert-rules-server";
import { todayYmd } from "@/lib/office-tasks/schedule";
import {
  buildRetainerHomeReadiness,
  listUpcomingRetainerBillings
} from "@/lib/retainer-package";
import { retainerBillingPeriodKey } from "@/lib/retainer-billing-autopilot-utils";
import { withCache } from "@/lib/sheets/cache";
import { getDocumentLog } from "@/lib/sheets/document-log";
import { dashboardFromMasterRows, getAllMasterRows } from "@/lib/sheets/master";
import { getPendingArEntries } from "@/lib/sheets/pending-ar";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target >= now && target <= end;
}

function clientSummaryForRetainers(row: unknown[]) {
  return {
    code: String(row[0] || ""),
    name: String(row[1] || ""),
    caseTitle: String(row[2] || ""),
    email: String(row[4] || ""),
    retainerBalance: Number(row[23]) || 0,
    matterType: resolveClientMatterType({
      matterType: String(row[32] || ""),
      caseTitle: String(row[2] || ""),
      retainerBalance: Number(row[23]) || 0
    })
  };
}

export async function getHomeDashboard(accessToken: string): Promise<HomeDashboard> {
  return withCache(accessToken, "home-dashboard", 45_000, async () => {
    const master = await getAllMasterRows(accessToken);
    const base = dashboardFromMasterRows(master);

    const active = master.filter(
      (row) => row[0] && String(row[20] || "Active").toLowerCase() !== "closed"
    );

    const [pendingAr, recentDocuments, alertRules] = await Promise.all([
      getPendingArEntries(accessToken, master),
      getDocumentLog(accessToken, { limit: 15 }),
      readFirmAlertRulesFromSettings(accessToken)
    ]);

    const overdueList = active
      .filter((row) => String(row[15]) === "Overdue" && Number(row[11]) >= alertRules.overdueBalanceMin)
      .map((row) => ({
        code: String(row[0]),
        name: String(row[1] || ""),
        caseTitle: String(row[2] || ""),
        totalDue: Number(row[11]) || 0,
        accountStatus: String(row[15] || "")
      }))
      .sort((a, b) => b.totalDue - a.totalDue);

    const followUpThisWeek: FollowUpClient[] = active
      .filter((row) => {
        const followUp = parseDate(row[18]);
        const balance = Number(row[11]) || 0;
        return followUp && balance >= alertRules.balanceAlertMin && isWithinDays(followUp, alertRules.followUpHorizonDays);
      })
      .map((row) => ({
        code: String(row[0]),
        name: String(row[1] || ""),
        caseTitle: String(row[2] || ""),
        balance: Number(row[11]) || 0,
        nextFollowUp: String(row[18] || ""),
        accountStatus: String(row[15] || "")
      }))
      .sort((a, b) => new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime());

    const clientSummaries = active.map(clientSummaryForRetainers);
    const upcomingRetainers = listUpcomingRetainerBillings(clientSummaries, {
      today: todayYmd(),
      withinDays: 14
    }).map((row) => ({
      clientCode: row.clientCode,
      clientName: row.clientName,
      fee: row.fee,
      dueDate: row.dueDate,
      email: row.email,
      emailOk: row.emailOk,
      ready: row.ready,
      directoryLabel: row.directoryLabel
    }));

    const periodKey = retainerBillingPeriodKey(todayYmd());
    let retainerCount = 0;
    let chargedEstimate = 0;
    let paidEstimate = 0;
    let missingEmailCount = 0;
    let readyCount = 0;
    for (const client of clientSummaries) {
      const readiness = buildRetainerHomeReadiness(client);
      if (!readiness) continue;
      retainerCount += 1;
      chargedEstimate += readiness.fee;
      if (!readiness.emailOk) missingEmailCount += 1;
      if (readiness.ready) readyCount += 1;
    }

    return {
      ...base,
      pendingArCount: pendingAr.length,
      pendingAr,
      recentDocuments,
      overdueList,
      followUpThisWeek,
      upcomingRetainers,
      retainerMonthSummary: {
        periodKey,
        retainerCount,
        chargedEstimate,
        paidEstimate,
        missingEmailCount,
        dueCount: upcomingRetainers.length,
        readyCount
      }
    };
  });
}
