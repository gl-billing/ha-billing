type BridgeResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

export function isTasksAppsScriptConfigured(): boolean {
  return Boolean(
    process.env.TASKS_APPS_SCRIPT_WEB_APP_URL?.trim() &&
      process.env.TASKS_APPS_SCRIPT_WEB_APP_SECRET?.trim()
  );
}

export async function callTasksAppsScript(
  action: string,
  body: Record<string, unknown> = {}
): Promise<BridgeResponse> {
  const url = process.env.TASKS_APPS_SCRIPT_WEB_APP_URL?.trim();
  const secret = process.env.TASKS_APPS_SCRIPT_WEB_APP_SECRET?.trim();

  if (!url || !secret) {
    const billingOnly = Boolean(
      process.env.APPS_SCRIPT_WEB_APP_URL?.trim() && process.env.APPS_SCRIPT_WEB_APP_SECRET?.trim()
    );
    throw new Error(
      billingOnly
        ? "Tasks Apps Script bridge is not configured. Add TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET (Office Tasks spreadsheet deployment — not the billing APPS_SCRIPT_* URL). On Vercel: Settings → Environment Variables → Redeploy."
        : "Tasks Apps Script bridge is not configured. Set TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET."
    );
  }

  const endpoint = new URL(url);
  endpoint.searchParams.set("action", action);
  endpoint.searchParams.set("token", secret);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: secret, ...body }),
    cache: "no-store"
  });

  const data = (await response.json()) as BridgeResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Apps Script action failed: ${action}`);
  }
  return data;
}
