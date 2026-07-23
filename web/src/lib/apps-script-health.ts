import type { AppsScriptResult } from "@/lib/apps-script";
import { appsScriptConfigError, callAppsScriptWebApp, isAppsScriptConfigured } from "@/lib/apps-script";
import {
  callTasksAppsScript,
  isTasksAppsScriptConfigured
} from "@/lib/office-tasks/apps-script";

export type AppsScriptHealthStatus = {
  id: "billing-apps-script" | "tasks-apps-script";
  label: string;
  configured: boolean;
  ok: boolean;
  status: "ok" | "warn" | "error";
  message: string;
  scriptUser?: string;
  deployHint?: string;
};

function classifyAppsScriptError(message: string): { status: "warn" | "error"; deployHint?: string } {
  if (/out of date|Unknown action|paste the latest|New version|Deploy →/i.test(message)) {
    return {
      status: "warn",
      deployHint:
        "Extensions → Apps Script → paste the latest WebAppApi.gs from the repo → Deploy → Manage deployments → Edit → New version → Deploy."
    };
  }
  if (/not configured|APPS_SCRIPT_WEB_APP/i.test(message)) {
    return { status: "warn" };
  }
  return { status: "error" };
}

function healthFromPing(
  id: AppsScriptHealthStatus["id"],
  label: string,
  configured: boolean,
  ping: () => Promise<AppsScriptResult>,
  configError: string
): Promise<AppsScriptHealthStatus> {
  if (!configured) {
    return Promise.resolve({
      id,
      label,
      configured: false,
      ok: false,
      status: "warn",
      message: configError
    });
  }

  return ping()
    .then((result) => ({
      id,
      label,
      configured: true,
      ok: true,
      status: "ok" as const,
      message: result.message || "Connected.",
      scriptUser: typeof result.user === "string" ? result.user : undefined
    }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Connection check failed.";
      const classified = classifyAppsScriptError(message);
      return {
        id,
        label,
        configured: true,
        ok: false,
        status: classified.status,
        message,
        deployHint: classified.deployHint
      };
    });
}

export async function getBillingAppsScriptHealth(): Promise<AppsScriptHealthStatus> {
  return healthFromPing(
    "billing-apps-script",
    "Billing Apps Script",
    isAppsScriptConfigured(),
    () => callAppsScriptWebApp("ping", {}),
    appsScriptConfigError()
  );
}

export async function getTasksAppsScriptHealth(): Promise<AppsScriptHealthStatus> {
  return healthFromPing(
    "tasks-apps-script",
    "Tasks Apps Script",
    isTasksAppsScriptConfigured(),
    () => callTasksAppsScript("ping"),
    "Set TASKS_APPS_SCRIPT_WEB_APP_URL and TASKS_APPS_SCRIPT_WEB_APP_SECRET on Vercel."
  );
}

export async function getAppsScriptIntegrationHealth(): Promise<AppsScriptHealthStatus[]> {
  return Promise.all([getBillingAppsScriptHealth(), getTasksAppsScriptHealth()]);
}
