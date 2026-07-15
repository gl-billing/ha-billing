import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { buildCaseOptionsFromTaskItems } from "@/lib/office-tasks/case-options-from-items";
import { enrichCaseOptionsFromItems } from "@/lib/office-tasks/enrich-case-options";
import { firmMatterCaseOptions } from "@/lib/office-tasks/firm-matters";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import { buildCaseOptions, listWalkInClients } from "@/lib/sheets/walk-ins";
import { getClients } from "@/lib/sheets/master";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const billingAccess = canAccessBilling(session?.user?.email);
    const url = new URL(request.url);
    const includeClosed = url.searchParams.get("includeClosed") === "1";

    if (!billingAccess) {
      const items = await getCachedAllItems(accessToken).catch(() => []);
      const clients = enrichCaseOptionsFromItems(
        [...firmMatterCaseOptions(), ...buildCaseOptionsFromTaskItems(items)],
        items
      ).filter((option) => option.kind !== "firm");
      return NextResponse.json({
        clients,
        walkIns: [],
        firmMatters: firmMatterCaseOptions(),
        tasksOnly: true
      });
    }

    const [clients, walkIns, items] = await Promise.all([
      withCache(accessToken, `clients:${includeClosed ? "all" : "active"}`, 60_000, () =>
        getClients(accessToken, { includeClosed })
      ),
      withCache(accessToken, "walk-ins", 30_000, () => listWalkInClients(accessToken)),
      getCachedAllItems(accessToken).catch(() => [])
    ]);

    const options = buildCaseOptions(clients, walkIns, { includeClosed });
    const firmMatters = firmMatterCaseOptions();
    const enriched = enrichCaseOptionsFromItems([...firmMatters, ...options.clients], items);
    options.clients = enriched.filter((option) => option.kind !== "firm");
    options.walkIns = enrichCaseOptionsFromItems(options.walkIns, items);

    return NextResponse.json({ ...options, firmMatters });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load case options.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
