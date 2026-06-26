import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { warmWorkspaceSheetCaches } from "@/lib/sheets/workspace-bootstrap";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const warmed = await warmWorkspaceSheetCaches(accessToken, fresh);
    return NextResponse.json({ ok: true, ...warmed });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Bootstrap failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
