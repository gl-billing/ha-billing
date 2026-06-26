import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { loadOfficeHubSummary } from "@/lib/office-hub/summary";
import { withCachedOfficeHubSummary } from "@/lib/office-tasks/tasks-cache";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getSafeServerSession();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await requireSessionAccessToken();
    const summary = await withCachedOfficeHubSummary(token, () => loadOfficeHubSummary(email));
    return NextResponse.json(summary);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load office hub summary.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
