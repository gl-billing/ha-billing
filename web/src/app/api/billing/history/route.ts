import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import {
  getFirmBillingHistory,
  type BillingHistoryFilter
} from "@/lib/sheets/billing-history";

const FILTERS: BillingHistoryFilter[] = ["all", "ledger", "documents", "clients"];

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
    const rawFilter = searchParams.get("filter") || "all";
    const filter = FILTERS.includes(rawFilter as BillingHistoryFilter)
      ? (rawFilter as BillingHistoryFilter)
      : "all";

    const items = await getFirmBillingHistory(accessToken, { limit, filter });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load billing history.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
