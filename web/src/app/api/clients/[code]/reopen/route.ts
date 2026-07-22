import { NextResponse } from "next/server";
import { requireBillingAccessToken, sessionAuditEmail } from "@/lib/api-auth";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { reopenClient } from "@/lib/sheets/master";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = decodeURIComponent(code);

    const result = await reopenClient(accessToken, clientCode);

    await appendAuditLog(accessToken, {
      user: await sessionAuditEmail(),
      action: "client.reopen",
      clientCode,
      summary: "Client reopened",
      details: ""
    });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, `profile:${clientCode}`);

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to reopen client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
