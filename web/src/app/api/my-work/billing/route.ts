import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { canAccessBilling } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { buildMyWorkBillingSummary } from "@/lib/my-work-billing";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getHomeDashboard } from "@/lib/sheets/home";
import { getAllMasterRows } from "@/lib/sheets/master";
import { getCachedEmployeeDirectory } from "@/lib/office-tasks/tasks-cache";

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
    const payload = await withCache(accessToken, "my-work-billing", 45_000, async () => {
      const [dashboard, master, directory] = await Promise.all([
        getHomeDashboard(accessToken),
        getAllMasterRows(accessToken),
        getCachedEmployeeDirectory(accessToken).catch(() => [])
      ]);
      const roster = directory.map((employee) => employee.name).filter(Boolean);
      return buildMyWorkBillingSummary(dashboard, master, {
        email,
        name: session?.user?.name,
        roster
      });
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load billing to do's.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
