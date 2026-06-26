import { NextResponse } from "next/server";
import { verifyClientPortalToken } from "@/lib/client-portal-token";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { getClientDetail } from "@/lib/sheets/master";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { FIRM_CONTACT } from "@/lib/firm-email-signature";
import { triggerTaskOnPortalPaymentProof } from "@/lib/billing-task-triggers";

type Body = {
  token?: string;
  message?: string;
  intent?: "general" | "payment_proof";
  paymentAmount?: string;
  paymentMethod?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const token = body.token?.trim();
    const message = body.message?.trim();
    const intent = body.intent === "payment_proof" ? "payment_proof" : "general";

    if (!token || !message) {
      return NextResponse.json({ error: "Token and message are required." }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }

    const payload = verifyClientPortalToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Link expired or invalid." }, { status: 401 });
    }

    const accessToken = await requireBillingAccessToken();
    const client = await getClientDetail(accessToken, payload.clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const auditSummary =
      intent === "payment_proof"
        ? `Payment proof from ${client.name}`
        : `Portal message from ${client.name}`;

    await appendAuditLog(accessToken, {
      user: `client:${payload.clientCode}`,
      action: intent === "payment_proof" ? "client.portal.payment_proof" : "client.portal.message",
      clientCode: payload.clientCode,
      summary: auditSummary,
      details: message
    });

    let billingTaskId: string | null = null;
    if (intent === "payment_proof") {
      billingTaskId = await triggerTaskOnPortalPaymentProof(accessToken, payload.clientCode, {
        note: message,
        amount: body.paymentAmount,
        method: body.paymentMethod
      }).catch(() => null);
    }

    const firmInbox = FIRM_CONTACT.email;
    if (firmInbox) {
      try {
        const subject =
          intent === "payment_proof"
            ? `Payment proof — ${client.name} (${payload.clientCode})`
            : `Client portal message — ${client.name} (${payload.clientCode})`;
        const lead =
          intent === "payment_proof"
            ? `<p><strong>${client.name}</strong> (${payload.clientCode}) reported a payment via the client portal:</p>`
            : `<p><strong>${client.name}</strong> (${payload.clientCode}) sent a message via the client portal:</p>`;
        await sendClientEmailViaGmail({
          accessToken,
          to: firmInbox,
          subject,
          html: `${lead}<p>${message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`,
          plain:
            `${auditSummary} (${payload.clientCode}) via the client portal:\n\n` +
            `${message}\n\n` +
            `— Sent through HA Office client portal`
        });
      } catch {
        /* audit log is the source of truth */
      }
    }

    return NextResponse.json({
      ok: true,
      billingTaskId,
      message:
        intent === "payment_proof"
          ? "Payment proof received. Our billing team will verify and update your account."
          : "Message sent to the firm. We will respond as soon as we can."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
