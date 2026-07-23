import { callAppsScriptWebApp, isAppsScriptConfigured, appsScriptConfigError } from "@/lib/apps-script";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { formatSheetsBackupAudit } from "@/lib/sheets/critical-audit";
import { runCronRoute } from "@/lib/cron-route-handler";

/** Vercel Cron — nightly spreadsheet backup (see vercel.json crons). */
export async function GET(request: Request) {
  return runCronRoute(request, "sheets-backup", async () => {
    if (!isAppsScriptConfigured()) {
      throw new Error(appsScriptConfigError());
    }

    const result = await callAppsScriptWebApp("backupSpreadsheet", {});
    const message = String(result.message || "Spreadsheet backup created.");

    try {
      const token = await getCronGoogleAccessToken();
      if (token) {
        const audit = formatSheetsBackupAudit(message);
        await appendAuditLog(token, {
          user: "nightly-backup-cron",
          action: "sheets.backup",
          summary: audit.summary,
          details: audit.details
        });
      }
    } catch {
      /* backup succeeded; audit is best-effort */
    }

    return { ...result, message };
  });
}
