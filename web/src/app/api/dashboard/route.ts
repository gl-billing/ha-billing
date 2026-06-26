import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getDashboard } from "@/lib/sheets/master";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const dashboard = await getDashboard(accessToken);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
