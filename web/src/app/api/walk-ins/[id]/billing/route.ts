import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { WalkInBillingPayload } from "@/lib/gl-config";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateBillingReadCaches, invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { recordWalkInBilling } from "@/lib/sheets/walk-ins";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { id } = await context.params;
    const body = (await request.json()) as WalkInBillingPayload;

    const walkIn = await recordWalkInBilling(accessToken, id, body);
    invalidateCache(accessToken, "walk-ins");
    if (walkIn.promotedClientCode) {
      invalidateBillingReadCaches(accessToken);
      invalidateCache(accessToken, `profile:${walkIn.promotedClientCode}`);
    }

    const session = await getServerSession(authOptions);
    await appendAuditLog(accessToken, {
      user: session?.user?.email || "system",
      action: "walkin.billing",
      clientCode: walkIn.walkInId,
      summary: `${walkIn.billingStatus || "Billed"} — ${body.serviceType}`,
      details:
        walkIn.billingStatus === "Retainer"
          ? "Retainer visit — no charge"
          : `Charge ${walkIn.chargeAmount}${walkIn.paymentAmount ? ` · Paid ${walkIn.paymentAmount}` : ""}`
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      walkIn,
      message:
        walkIn.billingStatus === "Retainer"
          ? `Retainer visit recorded for ${walkIn.name} (no charge).`
          : walkIn.billingStatus === "Paid"
            ? `Payment recorded for ${walkIn.name}.`
            : walkIn.billingStatus === "Partial"
              ? `Partial payment recorded for ${walkIn.name}.`
              : `Charge recorded for ${walkIn.name}.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to record walk-in billing.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
