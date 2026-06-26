import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getAuditLog } from "@/lib/sheets/audit-log";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get("clientCode") || undefined;
    const limit = Number(searchParams.get("limit")) || 50;

    const entries = await getAuditLog(accessToken, { clientCode, limit });
    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load audit log.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
