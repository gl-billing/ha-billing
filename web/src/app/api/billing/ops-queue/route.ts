import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { canAccessBilling } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { buildBillingOpsQueue } from "@/lib/billing-ops-queue";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { getCachedEmployeeDirectory } from "@/lib/office-tasks/tasks-cache";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getHomeDashboard } from "@/lib/sheets/home";
import { getAllMasterRows } from "@/lib/sheets/master";
import { listNotarizations } from "@/lib/sheets/notarizations";
import { listWalkInClients } from "@/lib/sheets/walk-ins";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!canAccessBilling(email)) {
      return NextResponse.json({ error: "Billing access required." }, { status: 403 });
    }

    const accessToken = await requireSessionAccessToken();
    const payload = await withCache(accessToken, "billing-ops-queue", 45_000, async () => {
      const [dashboard, master, items, walkIns, notarizations, directory] = await Promise.all([
        getHomeDashboard(accessToken),
        getAllMasterRows(accessToken),
        collectAllItems(accessToken).catch(() => []),
        listWalkInClients(accessToken).catch(() => []),
        listNotarizations(accessToken).catch(() => []),
        getCachedEmployeeDirectory(accessToken).catch(() => [])
      ]);

      return buildBillingOpsQueue({
        dashboard,
        master,
        items,
        walkIns,
        notarizations,
        email,
        name: session?.user?.name,
        roster: directory.map((employee) => employee.name).filter(Boolean)
      });
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load billing ops queue.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
