import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { buildClientDeletePreview } from "@/lib/sheets/client-delete-preview";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { sheetExists } from "@/lib/sheets/client";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { getClientDetail } from "@/lib/sheets/master";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const client = await getClientDetail(accessToken, clientCode);

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const hasLedgerTab = await sheetExists(accessToken, clientCode);
    const ledger = hasLedgerTab
      ? await getClientLedger(accessToken, clientCode)
      : { entries: [], summary: { totalDue: 0, payments: 0, charges: 0, entryCount: 0, chargeCount: 0, paymentCount: 0 } };

    const pendingArCount = ledger.entries.filter(
      (entry) => entry.type.toLowerCase() === "payment" && entry.payment > 0 && !entry.arSent
    ).length;

    const taskItems = await collectAllItems(accessToken).catch(() => []);
    const preview = buildClientDeletePreview(client, taskItems, pendingArCount);

    return NextResponse.json({ preview });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load delete preview.";
    const status =
      message.includes("owners/admins") || message.startsWith("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
