import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getClientLedger } from "@/lib/sheets/ledger-read";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const ledger = await getClientLedger(accessToken, clientCode);
    return NextResponse.json(ledger);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load ledger.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
