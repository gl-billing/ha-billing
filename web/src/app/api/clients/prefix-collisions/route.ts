import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { findPrefixCollisions } from "@/lib/sheets/prefix-collision";
import { getClients } from "@/lib/sheets/master";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const token = await requireBillingAccessToken();
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get("code") || "";
    const clientName = searchParams.get("name") || "";
    const caseTitle = searchParams.get("caseTitle") || "";

    if (!clientCode.trim() && !clientName.trim() && !caseTitle.trim()) {
      return NextResponse.json({ taskPrefix: "", clientCaseLabel: "", matches: [] });
    }

    const clients = await getClients(token, { includeClosed: true });
    const result = findPrefixCollisions(clients, { clientCode, clientName, caseTitle });

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not check client codes.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
