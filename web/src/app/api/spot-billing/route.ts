import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { isQuotaError, quotaErrorMessage, invalidateCache, withCache } from "@/lib/sheets/cache";
import { listSpotBillingEntries } from "@/lib/sheets/spot-billing";

export async function GET(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim().toLowerCase();

    let entries = await withCache(accessToken, "spot-billing", 30_000, () =>
      listSpotBillingEntries(accessToken)
    );

    if (status === "active") {
      entries = entries.filter((entry) => entry.status === "Active");
    } else if (status === "closed") {
      entries = entries.filter((entry) => entry.status === "Closed");
    }

    entries.sort((a, b) => b.rowNumber - a.rowNumber);
    return NextResponse.json({ entries });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load spot billing.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as import("@/lib/gl-config").SpotBillingPayload;

    let assignedAttorney = body.assignedAttorney?.trim() || "";
    if (!assignedAttorney && body.linkedClientCode?.trim()) {
      const { getClientDetail } = await import("@/lib/sheets/master");
      const detail = await getClientDetail(accessToken, body.linkedClientCode.trim());
      assignedAttorney = detail?.assignedAttorney?.trim() || "";
    }

    const { createSpotBillingEntry } = await import("@/lib/sheets/spot-billing");
    const entry = await createSpotBillingEntry(accessToken, { ...body, assignedAttorney });
    invalidateCache(accessToken, "spot-billing");

    const { appendAuditLog } = await import("@/lib/sheets/audit-log");
    await appendAuditLog(accessToken, {
      user: session?.user?.email || "system",
      action: "spot-billing.create",
      clientCode: entry.spotId,
      summary: `Spot billing opened — ${entry.payerName}`,
      details: entry.serviceDescription
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      entry,
      message: entry.billingStatus
        ? `Spot billing ${entry.spotId} saved with ${entry.billingStatus.toLowerCase()} status.`
        : `Spot billing ${entry.spotId} opened for ${entry.payerName}.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save spot billing.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
