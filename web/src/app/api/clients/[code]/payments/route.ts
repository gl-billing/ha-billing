import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getClientPayments } from "@/lib/sheets/ledger-read";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const url = new URL(request.url);
    const onlyWithoutAr = url.searchParams.get("pending") === "1";

    const payments = await getClientPayments(accessToken, clientCode, onlyWithoutAr);
    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payments.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
