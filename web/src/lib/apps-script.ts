export type AppsScriptResult = {
  ok: boolean;
  message?: string;
  error?: string;
  results?: unknown[];
  service?: string;
  user?: string;
  pdfUrl?: string;
  url?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  [key: string]: unknown;
};

export function isAppsScriptConfigured(): boolean {
  return Boolean(
    process.env.APPS_SCRIPT_WEB_APP_URL?.trim() && process.env.APPS_SCRIPT_WEB_APP_SECRET?.trim()
  );
}

export function appsScriptConfigError(): string {
  return (
    "Apps Script is not configured on this server. In Vercel → Settings → Environment Variables, set APPS_SCRIPT_WEB_APP_URL and APPS_SCRIPT_WEB_APP_SECRET (same secret as Settings → Web App Secret in your billing spreadsheet), then redeploy."
  );
}

export async function callAppsScriptWebApp(
  action: string,
  body: Record<string, unknown> = {}
): Promise<AppsScriptResult> {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const secret = process.env.APPS_SCRIPT_WEB_APP_SECRET?.trim();

  if (!url || !secret) {
    throw new Error(appsScriptConfigError());
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: secret, ...body, action }),
      cache: "no-store"
    });
  } catch {
    throw new Error(
      "Could not reach the Apps Script Web App. Check APPS_SCRIPT_WEB_APP_URL and redeploy the script (Deploy → Manage deployments → New version)."
    );
  }

  const text = await response.text();
  let payload: Partial<AppsScriptResult> = {};

  try {
    payload = JSON.parse(text) as Partial<AppsScriptResult>;
  } catch {
    if (!text.trim()) {
      throw new Error("Apps Script returned an empty response.");
    }
    if (/login|sign in|accounts\.google/i.test(text)) {
      throw new Error(
        "Apps Script Web App URL looks wrong or access is blocked. Use the /exec URL from Deploy → Web app (Execute as: Me, Who has access: Anyone)."
      );
    }
    if (/^\s*<!DOCTYPE html|<html[\s>]/i.test(text)) {
      throw new Error(
        "Apps Script returned a web page instead of JSON. Check APPS_SCRIPT_WEB_APP_URL in server settings — it must be the /exec deployment URL (Deploy → Web app → Execute as: Me, Who has access: Anyone), then redeploy a new version."
      );
    }
    const snippet = text.trim().slice(0, 80);
    throw new Error(
      snippet
        ? `Apps Script returned a non-JSON response: ${snippet}${text.length > 80 ? "…" : ""}`
        : "Apps Script returned an unreadable response."
    );
  }

  if (!response.ok || payload.ok === false) {
    const err = payload.error || "Apps Script request failed.";
    if (/Unknown action:\s*setupAutoRefreshTrigger/i.test(err)) {
      throw new Error(
        "Your Apps Script Web App is out of date. In the billing spreadsheet: Extensions → Apps Script → open WebAppApi.gs (paste the latest from the repo if needed) → Deploy → Manage deployments → Edit → New version → Deploy. Then retry."
      );
    }
    if (/Unknown action:\s*(generateNotarialReceiptHeadless|getNrFolderHeadless)/i.test(err)) {
      throw new Error(
        "Your Apps Script Web App is out of date. Paste the latest WebAppApi.gs and WebAppHeadless.gs from the repo into Extensions → Apps Script, then Deploy → Manage deployments → Edit → New version → Deploy. Notarial receipts can also run without Apps Script if you add NR Folder ID in Settings."
      );
    }
    if (/setupAutoRefreshTrigger_/i.test(err) || /is not defined/i.test(err)) {
      throw new Error(
        `${err} Paste Triggers.gs into Apps Script, deploy a new Web App version, then try again.`
      );
    }
    if (/Invalid argument:\s*[^\s]+@[^\s]+/i.test(err) || /cannot send as/i.test(err)) {
      throw new Error(
        `${err} The Apps Script Web App runs as the Google account that deployed it (Deploy → Execute as: Me). Open Gmail for that account → Settings → Accounts → Send mail as → add info@hernandezassociates.com, or redeploy the Web App while signed in as janinerose@hernandezassociates.com (if that account already has Send mail as for info@). Then run authorizeGmailForWebApp() in Apps Script and deploy a new version.`
      );
    }
    if (/mail\.google\.com|gmail\.|GmailApp/i.test(err)) {
      throw new Error(
        `${err} In Apps Script, run authorizeGmailForWebApp() once from the editor (same Google account as Deploy → Execute as: Me), approve Gmail access, then Deploy → Manage deployments → New version → Deploy and retry.`
      );
    }
    if (/ScriptApp|trigger|permission/i.test(err)) {
      throw new Error(
        `${err} In Apps Script, run installHourlyDashboardRefresh() once from the editor to authorize triggers, then retry. On Vercel, hourly sync also runs automatically via cron when CRON_SECRET is set.`
      );
    }
    throw new Error(err);
  }

  return {
    ...payload,
    ok: true
  };
}
