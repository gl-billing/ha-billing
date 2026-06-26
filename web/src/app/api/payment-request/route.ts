import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getClientDetail } from "@/lib/sheets/master";
import {
  buildPaymentRequestUrl,
  buildPaymentRequestEmailPreview,
  createPaymentRequestToken
} from "@/lib/payment-request";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      clientCode?: string;
      amount?: number;
      sendEmail?: boolean;
      recipientEmail?: string;
    };

    const clientCode = String(body.clientCode || "").trim();
    if (!clientCode) {
      return NextResponse.json({ error: "Client code is required." }, { status: 400 });
    }

    const client = await getClientDetail(accessToken, clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : client.balance;
    if (amount <= 0) {
      return NextResponse.json({ error: "No balance due for payment request." }, { status: 400 });
    }

    const token = createPaymentRequestToken({
      clientCode: client.code,
      clientName: client.name,
      amount,
      caseTitle: client.caseTitle,
      preferredGreeting: client.preferredGreeting
    });
    const link = buildPaymentRequestUrl(token);

    let emailSent = false;
    const recipient = body.recipientEmail?.trim() || client.email?.trim();
    if (body.sendEmail && recipient) {
      const email = buildPaymentRequestEmailPreview(
        {
          clientCode: client.code,
          clientName: client.name,
          amount,
          caseTitle: client.caseTitle,
          preferredGreeting: client.preferredGreeting,
          exp: 0
        },
        link
      );
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
      action: "payment.request",
      clientCode: client.code,
      summary: emailSent ? "Payment request emailed" : "Payment request link created",
      details: link
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      link,
      amount,
      emailSent,
      message: emailSent ? "Payment link created and emailed." : "Payment link created."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to create payment link.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
