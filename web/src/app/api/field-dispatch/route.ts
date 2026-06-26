import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, requireAdminEmail } from "@/lib/admin";
import type { FieldDispatchPayload } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage, invalidateCache, withCache } from "@/lib/sheets/cache";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import {
  createFieldDispatch,
  listFieldDispatches,
  summarizeFieldDispatchesByLocation
} from "@/lib/sheets/field-dispatch";

const CACHE_KEY = "field-dispatch";

function errorResponse(error: unknown, fallback: string) {
  if (isQuotaError(error)) {
    return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.includes("firm admins") || message.includes("ADMIN_EMAILS")
      ? 403
      : message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const entries = await withCache(accessToken, CACHE_KEY, 30_000, () =>
      listFieldDispatches(accessToken)
    );
    const sorted = [...entries].sort((a, b) => b.rowNumber - a.rowNumber);
    const locationStats = summarizeFieldDispatchesByLocation(entries);

    return NextResponse.json({
      dispatches: sorted,
      locationStats,
      isAdmin: isAdminEmail(session?.user?.email)
    });
  } catch (error) {
    return errorResponse(error, "Failed to load field dispatches.");
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as FieldDispatchPayload;
    const recordedBy = session?.user?.displayName || session?.user?.email || "unknown";
    const entry = await createFieldDispatch(accessToken, body, recordedBy);

    invalidateCache(accessToken, CACHE_KEY);
    await appendAuditLog(accessToken, {
      user: session?.user?.email || "unknown",
      action: "field-dispatch.create",
      clientCode: entry.clientCode,
      summary: `${entry.dispatchId} · ${entry.location}`,
      details: `Advance ${entry.advanceGiven} · Service fee ${entry.serviceFee}`
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      message: `Field dispatch ${entry.dispatchId} recorded.`,
      dispatch: entry
    });
  } catch (error) {
    return errorResponse(error, "Failed to record field dispatch.");
  }
}
