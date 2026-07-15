import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { normalizeAllocationSettingsInput, type AllocationBucketKey } from "@/lib/firm-allocation";
import {
  getAllocationSettings,
  saveAllocationSettings,
  saveBucketOpeningBalances
} from "@/lib/sheets/firm-allocation";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const accessToken = await requireSessionAccessToken();
    const settings = await getAllocationSettings(accessToken);
    return NextResponse.json({ settings });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load allocation settings.";
    const status = message.startsWith("Unauthorized") || message.includes("firm admins") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      expensesPct?: number;
      savingsPct?: number;
      travelPct?: number;
      emergencyPct?: number;
      bucketOpening?: Partial<Record<AllocationBucketKey, number>>;
    };

    const accessToken = await requireSessionAccessToken();

    if (body.bucketOpening) {
      await saveBucketOpeningBalances(accessToken, {
        expenses: Number(body.bucketOpening.expenses ?? 0),
        savings: Number(body.bucketOpening.savings ?? 0),
        travel: Number(body.bucketOpening.travel ?? 0),
        emergency: Number(body.bucketOpening.emergency ?? 0)
      });
    }

    if (
      body.expensesPct !== undefined ||
      body.savingsPct !== undefined ||
      body.travelPct !== undefined ||
      body.emergencyPct !== undefined
    ) {
      const percents = normalizeAllocationSettingsInput(body);
      const settings = await saveAllocationSettings(accessToken, percents);
      return NextResponse.json({ settings, message: "Allocation settings saved." });
    }

    return NextResponse.json({ message: "Treasury settings saved." });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save allocation settings.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("must add up")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
