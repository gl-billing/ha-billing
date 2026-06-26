import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  repairInvalidSourceIds,
  runBillingHealthChecks,
  runTasksHealthChecks
} from "@/lib/health-checks";
import { runLedgerIncomeHealthChecks } from "@/lib/ledger-income-health";
import { withCachedHealthChecks, invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const billingAccess = canAccessBilling(session?.user?.email);

    const checks = await withCachedHealthChecks(accessToken, async () => {
      const tasks = await runTasksHealthChecks(accessToken);
      const billing = billingAccess
        ? [...(await runBillingHealthChecks(accessToken)), ...(await runLedgerIncomeHealthChecks(accessToken))]
        : [];
      return [...billing, ...tasks];
    });

    return NextResponse.json({ checks });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Health check failed.";
    const status = message.startsWith("Unauthorized") || message.includes("session expired") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as { action?: string };
    if (body.action === "repair-source-ids") {
      const result = await repairInvalidSourceIds(accessToken);
      invalidateTasksDataCache(accessToken);
      return NextResponse.json({
        ok: true,
        message: `Repaired ${result.tasks} task ID(s) and ${result.events} event ID(s).`
      });
    }
    return NextResponse.json({ error: "Unknown repair action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repair failed.";
    const status = message.startsWith("Unauthorized") || message.includes("session expired") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
