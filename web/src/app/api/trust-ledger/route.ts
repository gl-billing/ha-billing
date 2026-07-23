import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireMatterEditAccess } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { sessionAuditUser } from "@/lib/audit-user";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { addTrustLedgerEntry, getTrustLedger } from "@/lib/sheets/trust-ledger";
import type { TrustLedgerEntryType } from "@/lib/gl-config";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const url = new URL(request.url);
    const clientCode = url.searchParams.get("clientCode")?.trim().toUpperCase() || undefined;
    const data = await getTrustLedger(accessToken, { clientCode, limit: 120 });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load trust ledger.";
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    requireMatterEditAccess(session?.user?.email);
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as {
      clientCode?: string;
      clientName?: string;
      type?: TrustLedgerEntryType;
      amount?: number;
      description?: string;
      date?: string;
    };

    if (!body.clientCode?.trim() || !body.clientName?.trim()) {
      return NextResponse.json({ error: "Client code and name are required." }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const entry = await addTrustLedgerEntry(accessToken, {
      clientCode: body.clientCode,
      clientName: body.clientName,
      type: body.type || "Deposit",
      amount,
      description: body.description,
      recordedBy: sessionAuditUser(session),
      date: body.date
    });

    await appendAuditLog(accessToken, {
      user: sessionAuditUser(session),
      action: "trust.ledger.entry",
      clientCode: body.clientCode,
      summary: `Trust ${entry.type} — ${body.clientName}`,
      details: `${entry.amount} · balance ${entry.balance}`
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save trust entry.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
