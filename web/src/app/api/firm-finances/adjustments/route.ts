import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { AllocationBucketKey } from "@/lib/firm-allocation";
import { recordBucketAdjustment } from "@/lib/sheets/firm-allocation";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      bucket?: AllocationBucketKey;
      amount?: number;
      note?: string;
    };

    const accessToken = await requireSessionAccessToken();
    const result = await recordBucketAdjustment(accessToken, {
      bucket: body.bucket || "expenses",
      amount: Number(body.amount),
      note: String(body.note || "")
    });

    invalidateCache(accessToken, "firm-allocation");

    return NextResponse.json({
      ...result,
      message: "Bucket adjustment recorded."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to record adjustment.";
    const status =
      message.startsWith("Unauthorized") || message.includes("firm admins")
        ? 403
        : message.includes("Enter")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
