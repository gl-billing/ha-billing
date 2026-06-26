import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import type { WalkInClientPayload } from "@/lib/gl-config";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { createWalkInClient, listWalkInClients } from "@/lib/sheets/walk-ins";

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const walkIns = await listWalkInClients(accessToken);
    return NextResponse.json({ walkIns });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load walk-in clients.";
    const status =
      message.includes("do not have access") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const body = (await request.json()) as WalkInClientPayload;
    const result = await createWalkInClient(accessToken, body);
    invalidateCache(accessToken, "walk-ins");
    invalidateCache(accessToken, "clients:active");
    return NextResponse.json({
      ok: true,
      walkIn: result.walkIn,
      clientCase: result.clientCase,
      message: `Walk-in ${result.walkIn.walkInId} saved.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save walk-in client.";
    const status = message.includes("do not have access")
      ? 403
      : message.startsWith("Unauthorized")
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
