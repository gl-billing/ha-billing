import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { repairClientLedgerTab } from "@/lib/sheets/clients-create";
import { invalidateCache } from "@/lib/sheets/cache";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const result = await repairClientLedgerTab(accessToken, clientCode);

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "sheet-titles");
    invalidateCache(accessToken, `profile:${clientCode}`);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create ledger tab.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
