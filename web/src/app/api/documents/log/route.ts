import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getDocumentLog } from "@/lib/sheets/document-log";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const url = new URL(request.url);
    const clientCode = url.searchParams.get("clientCode");
    const limit = Number(url.searchParams.get("limit") || "50");

    const entries = await getDocumentLog(accessToken, {
      clientCode: clientCode ? sanitizeSheetName(clientCode) : undefined,
      limit: limit > 0 ? limit : 50
    });

    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load document log.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
