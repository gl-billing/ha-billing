import { NextResponse } from "next/server";
import { callAppsScriptWebApp, isAppsScriptConfigured, appsScriptConfigError } from "@/lib/apps-script";

/** Vercel Cron — hourly dashboard refresh (see vercel.json crons). */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim() || "";

  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isAppsScriptConfigured()) {
    return NextResponse.json({ error: appsScriptConfigError() }, { status: 503 });
  }

  try {
    const result = await callAppsScriptWebApp("refreshDashboard", {});
    return NextResponse.json({ ok: true, message: result.message || "Dashboard refreshed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
