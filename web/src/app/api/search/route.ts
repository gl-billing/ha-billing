import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchFirm } from "@/lib/firm-search";
import { getCachedAllItems, getCachedEmployeeDirectory } from "@/lib/office-tasks/tasks-cache";
import { getClients } from "@/lib/sheets/master";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const billingAccess = canAccessBilling(email);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) {
      return NextResponse.json({ results: [] });
    }

    const [clients, items, employeeDirectory] = await Promise.all([
      billingAccess
        ? withCache(accessToken, "clients:all", 60_000, () =>
            getClients(accessToken, { includeClosed: true })
          )
        : Promise.resolve([]),
      getCachedAllItems(accessToken).catch(() => []),
      getCachedEmployeeDirectory(accessToken).catch(() => [])
    ]);

    const employees = employeeDirectory.map((entry) => entry.name);
    const { results, intent, intentLabel } = searchFirm(q, clients, items, {
      billingAccess,
      limit: 24,
      employees
    });
    return NextResponse.json({ results, query: q.trim(), intent, intentLabel });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Search failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
