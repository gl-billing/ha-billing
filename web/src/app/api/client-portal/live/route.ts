import { NextResponse } from "next/server";
import { verifyClientPortalToken, type ClientPortalSnapshot } from "@/lib/client-portal-token";
import { formatPeso } from "@/lib/gl-config";
import { getDocumentLog } from "@/lib/sheets/document-log";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { getClientDetail } from "@/lib/sheets/master";
import { getAuditLog } from "@/lib/sheets/audit-log";
import { getPaymentInstructions } from "@/lib/payment-request";
import { requireBillingAccessToken } from "@/lib/api-auth";

export type ClientPortalPayment = {
  date: string;
  amount: number;
  method: string;
  description: string;
};

export type ClientPortalMessage = {
  at: string;
  text: string;
};

export type ClientPortalLiveData = ClientPortalSnapshot & {
  payments: ClientPortalPayment[];
  messages: ClientPortalMessage[];
  paymentInstructions?: {
    payee: string;
    gcash: string;
    maya: string;
    bank: string;
  };
};

async function buildLiveSnapshot(accessToken: string, clientCode: string): Promise<ClientPortalLiveData | null> {
  const client = await getClientDetail(accessToken, clientCode);
  if (!client) return null;

  const [documents, ledger, audit] = await Promise.all([
    getDocumentLog(accessToken, { clientCode, limit: 20 }),
    getClientLedger(accessToken, clientCode).catch(() => ({ entries: [], summary: null })),
    getAuditLog(accessToken, { clientCode, limit: 30 }).catch(() => []),
  ]);

  const lastSoa = documents.find((doc) => doc.documentType.toUpperCase() !== "AR");

  const payments: ClientPortalPayment[] = ledger.entries
    .filter((entry) => entry.type.toLowerCase() === "payment" && entry.payment > 0)
    .slice(-8)
    .reverse()
    .map((entry) => ({
      date: entry.date,
      amount: entry.payment,
      method: entry.method || "Payment",
      description: entry.description || entry.category || "Payment"
    }));

  const messages: ClientPortalMessage[] = audit
    .filter((row) => row.action === "client.portal.message")
    .slice(0, 10)
    .map((row) => ({
      at: row.timestamp,
      text: row.details || row.summary
    }));

  return {
    clientCode: client.code,
    clientName: client.name,
    caseTitle: client.caseTitle,
    balance: client.balance,
    retainerBalance: client.retainerBalance,
    preferredGreeting: client.preferredGreeting,
    lastSoaDate: lastSoa?.timestamp,
    lastSoaNumber: lastSoa?.documentNumber,
    lastSoaPdfUrl: lastSoa?.pdfUrl,
    documents: documents.map((doc) => ({
      logRow: doc.logRow,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      timestamp: doc.timestamp,
      pdfUrl: doc.pdfUrl,
      amount: doc.amount
    })),
    payments,
    messages,
    paymentInstructions: getPaymentInstructions()
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Token required." }, { status: 400 });
    }

    const payload = verifyClientPortalToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Link expired or invalid." }, { status: 401 });
    }

    const accessToken = await requireBillingAccessToken();
    const live = await buildLiveSnapshot(accessToken, payload.clientCode);
    if (!live) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json({
      snapshot: live,
      balanceLabel: formatPeso(live.balance),
      expiresAt: payload.exp
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
