import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import {
  checkClientCaseLabelForTaskEvent,
  checkClientCodeForIntake
} from "@/lib/sheets/client-code-check-server";
import { getClients } from "@/lib/sheets/master";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const token = await requireBillingAccessToken();
    const { searchParams } = new URL(request.url);
    const clientCase = searchParams.get("clientCase") || "";
    const clientCode = searchParams.get("code") || "";
    const clientName = searchParams.get("name") || "";
    const caseTitle = searchParams.get("caseTitle") || "";
    const caseNumber = searchParams.get("caseNumber") || "";
    const courtPending = searchParams.get("court") || "";

    if (!clientCase.trim() && !clientCode.trim() && !clientName.trim() && !caseTitle.trim()) {
      return NextResponse.json({
        codeConflict: null,
        taskPrefix: "",
        clientCaseLabel: "",
        prefixMatches: [],
        similarMatches: []
      });
    }

    const clients = await getClients(token, { includeClosed: true });
    const result = clientCase.trim()
      ? await checkClientCaseLabelForTaskEvent(token, clients, clientCase)
      : await checkClientCodeForIntake(token, clients, {
          clientCode,
          clientName,
          caseTitle,
          caseNumber,
          courtPending
        });

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not check client code.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
