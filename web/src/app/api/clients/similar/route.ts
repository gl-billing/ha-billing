import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { findSimilarClients } from "@/lib/sheets/client-similarity";
import { getClients } from "@/lib/sheets/master";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const url = new URL(request.url);
    const clients = await getClients(accessToken, { includeClosed: true });

    const matches = findSimilarClients(clients, {
      clientName: url.searchParams.get("name") || "",
      caseTitle: url.searchParams.get("caseTitle") || "",
      caseNumber: url.searchParams.get("caseNumber") || "",
      courtPending: url.searchParams.get("court") || "",
      clientCode: url.searchParams.get("code") || ""
    });

    return NextResponse.json({ matches });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Similarity check failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
