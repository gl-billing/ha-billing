import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { filterClientsByQuery, GL, type NewClientPayload } from "@/lib/gl-config";
import { createClient } from "@/lib/sheets/clients-create";
import { invalidateCache, isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getClients } from "@/lib/sheets/master";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const includeClosed = url.searchParams.get("includeClosed") === "1";

    let clients = await withCache(
      accessToken,
      `clients:${includeClosed ? "all" : "active"}`,
      60_000,
      () => getClients(accessToken, { includeClosed })
    );
    clients = filterClientsByQuery(clients, q);

    return NextResponse.json({
      clients,
      chargeCategories: GL.chargeCategories,
      paymentMethods: GL.paymentMethods
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load clients.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as NewClientPayload;
    const result = await createClient(accessToken, body);
    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, "sheet-titles");
    invalidateCache(accessToken, `profile:${result.clientCode}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create client.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
