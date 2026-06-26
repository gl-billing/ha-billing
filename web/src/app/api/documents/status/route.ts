import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import {
  appsScriptConfigError,
  callAppsScriptWebApp,
  isAppsScriptConfigured
} from "@/lib/apps-script";

export async function GET() {
  try {
    await requireSessionAccessToken();

    if (!isAppsScriptConfigured()) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: appsScriptConfigError()
      });
    }

    const result = await callAppsScriptWebApp("ping", {});
    return NextResponse.json({
      ok: true,
      configured: true,
      message: result.message,
      service: result.user ? "HA Billing Web API" : undefined,
      scriptUser: result.user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apps Script check failed.";
    return NextResponse.json({
      ok: false,
      configured: isAppsScriptConfigured(),
      error: message
    });
  }
}
