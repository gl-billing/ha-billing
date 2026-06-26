import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { listWalkInClients } from "@/lib/sheets/walk-ins";

export async function GET(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim().toLowerCase();
    const promotedCode = url.searchParams.get("promoted")?.trim().toUpperCase();

    let walkIns = await withCache(accessToken, "walk-ins", 30_000, () => listWalkInClients(accessToken));
    if (status === "active") {
      walkIns = walkIns.filter((w) => w.status === "Active");
    } else if (status === "promoted") {
      walkIns = walkIns.filter((w) => w.status === "Promoted");
    }
    if (promotedCode) {
      walkIns = walkIns.filter((w) => w.promotedClientCode.trim().toUpperCase() === promotedCode);
    }

    walkIns.sort((a, b) => b.rowNumber - a.rowNumber);
    return NextResponse.json({ walkIns });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load walk-in clients.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
