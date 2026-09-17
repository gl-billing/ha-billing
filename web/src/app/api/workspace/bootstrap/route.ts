import { NextResponse } from "next/server";
import { canAccessBilling } from "@/lib/app-access";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { warmWorkspaceSheetCaches } from "@/lib/sheets/workspace-bootstrap";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getSafeServerSession();
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const warmed = await warmWorkspaceSheetCaches(accessToken, {
      fresh,
      includeBilling: canAccessBilling(session?.user?.email)
    });
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
