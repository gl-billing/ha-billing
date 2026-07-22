import type { FollowUpClient, HomeDashboard } from "@/lib/gl-config";
import { readFirmAlertRulesFromSettings } from "@/lib/firm-alert-rules-server";
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

    return {
      ...base,
      pendingArCount: pendingAr.length,
      pendingAr,
      recentDocuments,
      overdueList,
      followUpThisWeek
    };
  });
}
