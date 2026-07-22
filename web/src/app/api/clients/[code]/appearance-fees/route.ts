import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getAppearanceFees } from "@/lib/sheets/ledger-read";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const appearanceFees = await getAppearanceFees(accessToken, clientCode);
    return NextResponse.json({ appearanceFees });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load appearance fees.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
