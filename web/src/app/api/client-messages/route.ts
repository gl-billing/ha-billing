import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { formatStaffDisplayName } from "@/lib/user-display";
import { getClients } from "@/lib/sheets/master";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import {
  appendClientMessage,
  listClientMessages,
  resolveClientMessageRecipient
} from "@/lib/office-tasks/client-messages";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { whatsAppShareUrl } from "@/lib/messenger-share";
import { normalizeStaffPhoneE164 } from "@/lib/staff-messenger-reminder";

function serializeMessage(message: {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  clientCode: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  gmailSent: boolean;
  whatsAppSent: boolean;
}) {
  return {
    id: message.id,
    sentAt: message.sentAt,
    fromEmail: message.fromEmail,
    fromName: message.fromName,
    clientCode: message.clientCode,
    toEmail: message.toEmail,
    toName: message.toName,
    subject: message.subject,
    body: message.body,
    gmailSent: message.gmailSent,
    whatsAppSent: message.whatsAppSent
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = await requireBillingAccessToken();
    const [sent, clients] = await Promise.all([listClientMessages(token, 80), getClients(token)]);

    const recipients = clients
      .map((client) =>
        resolveClientMessageRecipient({
          code: client.code,
          name: client.name,
          email: client.email,
          phone: client.phone
        })
      )
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      canCompose: true,
      sent: sent.map(serializeMessage),
      clients: recipients
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not load client messages.";
    const status = message.includes("Unauthorized") || message.includes("sign in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const clientCode = String(body.clientCode || "").trim().toUpperCase();
    const subject = String(body.subject || "").trim();
    const messageBody = String(body.body || "").trim();
    const sendWhatsApp = body.sendWhatsApp === true;

    const token = await requireBillingAccessToken();
    const clients = await getClients(token);
    const client = clients.find((row) => row.code.trim().toUpperCase() === clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const recipient = resolveClientMessageRecipient({
      code: client.code,
      name: client.name,
      email: client.email,
      phone: client.phone
    });
    if (!recipient) {
      return NextResponse.json(
        { error: "That client has no valid email on file. Update the client profile first." },
        { status: 400 }
      );
    }

    const fromName =
      formatStaffDisplayName(session?.user?.name, email) || session?.user?.name?.trim() || email;

    const html = messageBody
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    await sendClientEmailViaGmail({
      accessToken: token,
      fromEmail: email,
      to: recipient.email,
      subject,
      html: `<p>${html}</p>`,
      plain: messageBody
    });

    const message = await appendClientMessage(token, {
      fromEmail: email,
      fromName,
      clientCode: recipient.code,
      toEmail: recipient.email,
      toName: recipient.name,
      subject,
      body: messageBody,
      gmailSent: true,
      whatsAppSent: sendWhatsApp
    });

    await appendAuditLog(token, {
      user: email,
      action: "client.message.send",
      clientCode: recipient.code,
      summary: `Client message sent: ${subject}`,
      details: recipient.email
    });

    const phoneDigits = normalizeStaffPhoneE164(recipient.phone);
    const whatsAppUrl =
      sendWhatsApp && phoneDigits
        ? whatsAppShareUrl(
            `Hernandez & Associates\n\n${subject}\n\n${messageBody}`,
            phoneDigits
          )
        : sendWhatsApp
          ? whatsAppShareUrl(`Hernandez & Associates\n\n${subject}\n\n${messageBody}`)
          : null;

    return NextResponse.json({
      message: serializeMessage(message),
      whatsAppUrl,
      whatsAppMissingPhone: sendWhatsApp && !phoneDigits
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not send client message.";
    const status =
      message.includes("Unauthorized") || message.includes("sign in")
        ? 401
        : message.includes("required") ||
            message.includes("must be") ||
            message.includes("valid email") ||
            message.includes("Choose a client") ||
            message.includes("Gmail") ||
            message.includes("permission")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
