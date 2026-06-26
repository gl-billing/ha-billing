import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  buildClientPortalEmailPreview,
  buildClientPortalUrl,
  createClientPortalToken,
  formatPortalExpiry,
  type ClientPortalSnapshot
} from "@/lib/client-portal-token";
import { sanitizeSheetName } from "@/lib/gl-config";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { getDocumentLog } from "@/lib/sheets/document-log";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getClientDetail } from "@/lib/sheets/master";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { buildPaymentRequestUrl, createPaymentRequestToken, getPaymentInstructions } from "@/lib/payment-request";

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      clientCode?: string;
      sendEmail?: boolean;
      recipientEmail?: string;
      expiresInDays?: number;
    };

    const clientCode = sanitizeSheetName(String(body.clientCode || ""));
    if (!clientCode) {
      return NextResponse.json({ error: "Client code is required." }, { status: 400 });
    }

    const client = await getClientDetail(accessToken, clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const documents = await getDocumentLog(accessToken, { clientCode, limit: 20 });
    const lastSoa = documents.find((doc) => doc.documentType.toUpperCase() !== "AR");

    const snapshot: ClientPortalSnapshot = {
      clientCode: client.code,
      clientName: client.name,
      caseTitle: client.caseTitle,
      balance: client.balance,
      retainerBalance: client.retainerBalance,
      preferredGreeting: client.preferredGreeting,
      lastSoaDate: lastSoa?.timestamp || client.soaSent || undefined,
      lastSoaNumber: lastSoa?.documentNumber || client.lastInvoiceNumber || undefined,
      lastSoaPdfUrl: lastSoa?.pdfUrl || client.lastInvoiceUrl || undefined,
      documents: documents.map((doc) => ({
        logRow: doc.logRow,
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
        timestamp: doc.timestamp,
        pdfUrl: doc.pdfUrl,
        amount: doc.amount
      }))
    };

    const token = createClientPortalToken(snapshot, { expiresInDays: body.expiresInDays ?? 7 });
    const link = buildClientPortalUrl(token);
    const expiresAt = formatPortalExpiry(
      Math.floor(Date.now() / 1000) + (body.expiresInDays ?? 7) * 86_400
    );

    const recipient = body.recipientEmail?.trim() || client.email?.trim();
    let emailSent = false;
    if (body.sendEmail && recipient) {
      const email = buildClientPortalEmailPreview(snapshot, link, expiresAt);
      await sendClientEmailViaGmail({
        accessToken,
        fromEmail: session?.user?.email || undefined,
        to: recipient,
        subject: email.subject,
        html: email.html,
        plain: email.body
      });
      emailSent = true;
    }

    await appendAuditLog(accessToken, {
      user: session?.user?.email || "unknown",
      action: "client-portal.link",
      clientCode: client.code,
      summary: emailSent ? "Client portal link emailed" : "Client portal link created",
      details: link
    }).catch(() => undefined);

    const payUrl =
      snapshot.balance > 0.005
        ? buildPaymentRequestUrl(
            createPaymentRequestToken({
              clientCode: snapshot.clientCode,
              clientName: snapshot.clientName,
              amount: snapshot.balance,
              caseTitle: snapshot.caseTitle,
              preferredGreeting: snapshot.preferredGreeting,
              expiresInDays: 7
            })
          )
        : null;

    return NextResponse.json({
      ok: true,
      link,
      expiresAt,
      emailSent,
      snapshot,
      payUrl,
      paymentInstructions: getPaymentInstructions(),
      message: emailSent ? "Client portal link created and emailed." : "Client portal link created."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to create client portal link.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
