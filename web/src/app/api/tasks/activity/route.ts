import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getTaskActivity } from "@/lib/office-tasks/sheets/activity-log";

export async function GET(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 80), 200);
    const clientCode = searchParams.get("clientCode")?.trim().toUpperCase() || undefined;
    const clientName = searchParams.get("clientName")?.trim() || undefined;

    const activity = await getTaskActivity(token, { limit, clientCode, clientName });
    return NextResponse.json({ activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load activity.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
