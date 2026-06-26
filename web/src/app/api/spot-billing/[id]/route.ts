import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { SpotBillingTransactionPayload } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage, invalidateCache } from "@/lib/sheets/cache";
import { addSpotBillingTransaction, closeSpotBillingEntry } from "@/lib/sheets/spot-billing";
import { appendAuditLog } from "@/lib/sheets/audit-log";

type RouteContext = { params: Promise<{ id: string }> };

type Body = {
  action?: "transaction" | "close";
  billing?: SpotBillingTransactionPayload;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const { id } = await context.params;
    const body = (await request.json()) as Body;

    if (body.action === "close") {
      const entry = await closeSpotBillingEntry(accessToken, id);
      invalidateCache(accessToken, "spot-billing");
      await appendAuditLog(accessToken, {
        user: session?.user?.email || "system",
        action: "spot-billing.close",
        clientCode: entry.spotId,
        summary: `Spot billing closed — ${entry.payerName}`,
        details: entry.billingStatus || "No billing recorded"
      }).catch(() => undefined);

      return NextResponse.json({
        ok: true,
        entry,
        message: `Closed spot billing ${entry.spotId}.`
      });
    }

    if (!body.billing) {
      return NextResponse.json({ error: "Billing details are required." }, { status: 400 });
    }

    const entry = await addSpotBillingTransaction(accessToken, id, body.billing);
    invalidateCache(accessToken, "spot-billing");

    await appendAuditLog(accessToken, {
      user: session?.user?.email || "system",
      action: "spot-billing.transaction",
      clientCode: entry.spotId,
      summary: `${entry.billingStatus || "Updated"} — ${body.billing.serviceType}`,
      details: `Charge ${entry.chargeAmount}${entry.paymentAmount ? ` · Paid ${entry.paymentAmount}` : ""}`
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      entry,
      message:
        entry.billingStatus === "Paid"
          ? `Payment recorded for ${entry.payerName}.`
          : entry.billingStatus === "Partial"
            ? `Partial payment recorded for ${entry.payerName}.`
            : `Charge recorded for ${entry.payerName}.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to update spot billing.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
