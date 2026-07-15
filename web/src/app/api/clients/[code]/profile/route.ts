import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getUnifiedClientTimeline } from "@/lib/sheets/unified-timeline";
import { taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { sheetExists } from "@/lib/sheets/client";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { getClientDetail } from "@/lib/sheets/master";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import { getTaskActivity } from "@/lib/office-tasks/sheets/activity-log";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const includeTasks = new URL(request.url).searchParams.get("includeTasks") === "1";

    const cacheKey = includeTasks ? `profile:${clientCode}:full` : `profile:${clientCode}`;

    const payload = await withCache(accessToken, cacheKey, 30_000, async () => {
      const client = await getClientDetail(accessToken, clientCode);
      if (!client) return null;

      const hasLedgerTab = await sheetExists(accessToken, clientCode);
      const ledger = hasLedgerTab
        ? await getClientLedger(accessToken, clientCode)
        : {
            entries: [],
            summary: {
              totalDue: Number(client.balance) || 0,
              payments: 0,
              charges: 0,
              entryCount: 0,
              chargeCount: 0,
              paymentCount: 0
            }
          };

      const [taskItems, taskActivity] = includeTasks
        ? await Promise.all([
            getCachedAllItems(accessToken).catch(() => []),
            getTaskActivity(accessToken, {
              clientCode: taskCodeForBillingClient(client),
              limit: 40
            }).catch(() => [])
          ])
        : [[], []];

      const activity = await getUnifiedClientTimeline(
        accessToken,
        clientCode,
        client,
        ledger.entries,
        { taskItems, taskActivity }
      );

      return { client, ledger, activity, missingLedgerTab: !hasLedgerTab };
    });

    if (!payload) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load client profile.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
