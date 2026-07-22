import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getClientDetail } from "@/lib/sheets/master";
import { checkSoaDuplicateWarning } from "@/lib/soa-follow-up";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));

    const client = await getClientDetail(accessToken, clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const check = await checkSoaDuplicateWarning(accessToken, clientCode, client.balance);
    return NextResponse.json({
      ...check,
      soaSent: client.soaSent || "",
      balance: client.balance
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not check SOA status.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
