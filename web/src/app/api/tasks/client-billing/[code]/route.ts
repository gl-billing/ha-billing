import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { getTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { sheetExists } from "@/lib/sheets/client";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { findClientForTaskCode } from "@/lib/sheets/master";
import { resolveClientMatterType } from "@/lib/client-matter-type";
import { getUnifiedClientTimeline } from "@/lib/sheets/unified-timeline";
import { taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!canAccessBilling(session.user.email)) {
      return NextResponse.json({ available: false });
    }

    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const taskCode = decodeURIComponent(code).trim().toUpperCase();
    const caseHint = new URL(request.url).searchParams.get("case")?.trim() || undefined;

    const client = await withCache(
      accessToken,
      `task-billing:${taskCode}:${caseHint || ""}`,
      30_000,
      () => findClientForTaskCode(accessToken, taskCode, caseHint)
    );

    if (!client) {
      return NextResponse.json({ available: true, found: false, taskCode });
    }

    const [hasLedgerTab, ledger, taskItems, taskActivity] = await Promise.all([
      sheetExists(accessToken, client.code),
      getClientLedger(accessToken, client.code).catch(() => ({
        entries: [],
        summary: { totalDue: 0, payments: 0, charges: 0, entryCount: 0, chargeCount: 0, paymentCount: 0 }
      })),
      collectAllItems(accessToken).catch(() => []),
      getTaskActivity(accessToken, {
        clientCode: taskCodeForBillingClient(client),
        clientName: client.name,
        limit: 40
      }).catch(() => []),
    ]);

    const activity = await getUnifiedClientTimeline(
      accessToken,
      client.code,
      client,
      hasLedgerTab ? ledger.entries : [],
      { taskItems, taskActivity, taskGroupCode: taskCodeForBillingClient(client) }
    );

    return NextResponse.json({
      available: true,
      found: true,
      taskCode,
      activity,
      detail: client,
      ledger: {
        entries: hasLedgerTab ? ledger.entries : [],
        summary: ledger.summary
      },
      missingLedgerTab: !hasLedgerTab,
      client: {
        code: client.code,
        name: client.name,
        caseTitle: client.caseTitle,
        caseType: client.caseType,
        caseTypeOther: client.caseTypeOther,
        caseNumber: client.caseNumber,
        caseRole: client.caseRole,
        courtPending: client.courtPending,
        matterType: resolveClientMatterType(client),
        balance: client.balance,
        accountStatus: client.accountStatus,
        status: client.status,
        email: client.email,
        phone: client.phone,
        address: client.address,
        assignedAttorney: client.assignedAttorney,
        retainerBalance: client.retainerBalance,
        lastBillingDate: client.lastBillingDate,
        nextFollowUp: client.nextFollowUp,
        lastActivity: client.lastActivity,
        psychologistName: client.psychologistName,
        psychologistPhone: client.psychologistPhone,
        psychologistAddress: client.psychologistAddress
      }
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load billing record.";
    const status = message.startsWith("Unauthorized") || message.includes("access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
