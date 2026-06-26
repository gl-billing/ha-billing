import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { closeClient } from "@/lib/sheets/master";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { code } = await context.params;
    const body = await request.json();
    const reason = String(body.reason || "");

    const result = await closeClient(accessToken, decodeURIComponent(code), reason);

    const session = await getServerSession(authOptions);
    await appendAuditLog(accessToken, {
      user: session?.user?.email || "unknown",
      action: "client.close",
      clientCode: decodeURIComponent(code),
      summary: "Client closed",
      details: reason
    });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, `profile:${decodeURIComponent(code)}`);

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to close client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
