import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { listFieldDispatches } from "@/lib/sheets/field-dispatch";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code)).trim().toUpperCase();
    const entries = await withCache(accessToken, "field-dispatch", 30_000, () =>
      listFieldDispatches(accessToken)
    );
    const dispatches = entries
      .filter((entry) => entry.status.toLowerCase() !== "deleted")
      .filter((entry) => entry.clientCode.trim().toUpperCase() === clientCode)
      .sort((a, b) => b.rowNumber - a.rowNumber);

    return NextResponse.json({ dispatches });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load field dispatches.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
