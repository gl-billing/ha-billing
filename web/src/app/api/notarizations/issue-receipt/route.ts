import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { issueNotarizationReceipt } from "@/lib/sheets/notarizations";

const CACHE_KEY = "notarizations";

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const body = (await request.json()) as { receiptNo?: string };
    const receiptNo = body.receiptNo?.trim() || "";
    if (!receiptNo) {
      return NextResponse.json({ error: "Receipt number is required." }, { status: 400 });
    }

    const entry = await issueNotarizationReceipt(accessToken, receiptNo);
    invalidateCache(accessToken, CACHE_KEY);

    return NextResponse.json({
      ok: true,
      notarization: entry,
      receiptNumber: entry.receiptNo,
      message: `Acknowledgment receipt issued for ${entry.receiptNo}. Use View to open or print the PDF.`
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to issue receipt.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
