import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { isQuotaError, quotaErrorMessage, invalidateCache, withCache } from "@/lib/sheets/cache";
import {
  createNotarization,
  deleteNotarization,
  issueNotarizationReceipt,
  listNotarizations,
  restoreNotarization,
  updateNotarization
} from "@/lib/sheets/notarizations";
import { canDeleteNotarizations, requireNotarizationManage } from "@/lib/admin";
import type { NotarizationPayload, NotarizationUpdatePayload } from "@/lib/gl-config";

const CACHE_KEY = "notarizations";

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const entries = await withCache(accessToken, CACHE_KEY, 30_000, () => listNotarizations(accessToken));
    const sorted = [...entries].sort((a, b) => b.rowNumber - a.rowNumber);
    return NextResponse.json({
      notarizations: sorted,
      isAdmin: canDeleteNotarizations(session?.user?.email),
      canManage: canDeleteNotarizations(session?.user?.email)
    });
  } catch (error) {
    return errorResponse(error, "Failed to load notarizations.");
  }
}

export async function DELETE(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireNotarizationManage(session?.user?.email);

    const url = new URL(request.url);
    const receiptNo = url.searchParams.get("receiptNo")?.trim() || "";
    if (!receiptNo) {
      return NextResponse.json({ error: "Receipt number is required." }, { status: 400 });
    }

    const deleted = await deleteNotarization(accessToken, receiptNo);
    invalidateCache(accessToken, CACHE_KEY);
    return NextResponse.json({
      ok: true,
      message: `Notarization ${deleted.receiptNo} deleted.`,
      undo: {
        receiptNo: deleted.receiptNo,
        previousStatus: deleted.previousStatus,
        entry: deleted.entry
      }
    });
  } catch (error) {
    return errorResponse(error, "Failed to delete notarization.");
  }
}

export async function PATCH(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireNotarizationManage(session?.user?.email);

    const body = (await request.json()) as { receiptNo?: string; previousStatus?: string };
    const receiptNo = body.receiptNo?.trim() || "";
    if (!receiptNo) {
      return NextResponse.json({ error: "Receipt number is required." }, { status: 400 });
    }

    const entry = await restoreNotarization(accessToken, receiptNo, body.previousStatus?.trim());
    invalidateCache(accessToken, CACHE_KEY);
    return NextResponse.json({
      ok: true,
      message: `Notarization ${entry.receiptNo} restored.`,
      notarization: entry
    });
  } catch (error) {
    return errorResponse(error, "Failed to restore notarization.");
  }
}

export async function PUT(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireNotarizationManage(session?.user?.email);

    const payload = (await request.json()) as NotarizationUpdatePayload;
    const receiptNo = payload.receiptNo?.trim() || "";
    if (!receiptNo) {
      return NextResponse.json({ error: "Receipt number is required." }, { status: 400 });
    }

    const entry = await updateNotarization(accessToken, { ...payload, receiptNo });
    invalidateCache(accessToken, CACHE_KEY);
    return NextResponse.json({
      ok: true,
      message: `Notarization ${entry.receiptNo} updated.`,
      notarization: entry
    });
  } catch (error) {
    return errorResponse(error, "Failed to update notarization.");
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const recordedBy = session?.user?.name || session?.user?.email || "";

    const payload = (await request.json()) as NotarizationPayload;
    const entry = await createNotarization(accessToken, payload, recordedBy);
    invalidateCache(accessToken, CACHE_KEY);

    let receiptWarning: string | null = null;
    let successMessage = payload.generateReceipt
      ? `Notarization ${entry.receiptNo} recorded.`
      : `Notarization ${entry.receiptNo} recorded without a receipt. Use Issue receipt in the table when ready.`;

    if (payload.generateReceipt) {
      try {
        const issued = await issueNotarizationReceipt(accessToken, entry.receiptNo);
        Object.assign(entry, issued);
        invalidateCache(accessToken, CACHE_KEY);
        successMessage = `Notarization ${entry.receiptNo} recorded. Acknowledgment receipt generated — use View in the table to open or print the PDF.`;
      } catch (genError) {
        receiptWarning =
          genError instanceof Error
            ? `Notarization recorded, but receipt generation failed: ${genError.message} Use Issue receipt in the table to try again.`
            : "Notarization recorded, but receipt generation failed. Use Issue receipt in the table to try again.";
      }
    }

    let ledgerNote: string | null = null;
    if (payload.postToLedger && payload.clientCode?.trim() && payload.billingKind !== "retainer") {
      try {
        const { addLedgerEntry } = await import("@/lib/sheets/ledger");
        const { invalidateBillingReadCaches } = await import("@/lib/sheets/cache");
        const clientCode = payload.clientCode.trim().toUpperCase();
        await addLedgerEntry(accessToken, {
          clientCode,
          type: "Payment",
          date: entry.date,
          category: "Notarial Fee",
          description: `Notarization · ${entry.receiptNo} · ${entry.documentType}`,
          payment: entry.amount,
          method: entry.paymentMethod || undefined,
          details: entry.paymentDetails || undefined
        });
        invalidateBillingReadCaches(accessToken);
        ledgerNote = `Posted ${entry.amount} to ${clientCode} ledger.`;
      } catch (ledgerError) {
        receiptWarning = [
          receiptWarning,
          ledgerError instanceof Error
            ? `Ledger post failed: ${ledgerError.message}`
            : "Ledger post failed."
        ]
          .filter(Boolean)
          .join(" ");
      }
    }

    return NextResponse.json({
      notarization: entry,
      receiptNumber: entry.pdfLink ? entry.receiptNo : undefined,
      message: [receiptWarning || successMessage, ledgerNote].filter(Boolean).join(" "),
      warning: receiptWarning
    });
  } catch (error) {
    return errorResponse(error, "Failed to record notarization.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (isQuotaError(error)) {
    return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.startsWith("Unauthorized") ||
    message.includes("do not have access") ||
    message.includes("firm admins") ||
    message.includes("desk editors") ||
    message.includes("edit or delete notarizations")
      ? 403
      : 500;
  return NextResponse.json({ error: message }, { status });
}
