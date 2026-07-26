import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { formatStaffDisplayName } from "@/lib/user-display";
import {
  appendStaffMessage,
  countUnreadMessages,
  isMessengerCollaboratingCounsel,
  listInboxForEmail,
  listStaffMessages,
  resolveCounselRecipient,
  resolveEmployeeRecipient
} from "@/lib/office-tasks/staff-messages";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { listExternalCounsel } from "@/lib/office-tasks/sheets/external-counsel";
import {
  counselMessageWhatsAppText,
  staffMessageMailtoUrl,
  staffMessageWhatsAppUrl
} from "@/lib/staff-message-share";
import { normalizeStaffPhoneE164, staffPhoneForReminders } from "@/lib/staff-messenger-reminder";
import { whatsAppShareUrl } from "@/lib/messenger-share";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = await requireSessionAccessToken();
    const isAdmin = isAdminEmail(email);
    const inbox = await listInboxForEmail(token, email);
    const sent = (await listStaffMessages(token, 40)).filter((row) => row.fromEmail === email);
    const [directory, counselDirectory] = await Promise.all([
      getEmployeeDirectory(token),
      listExternalCounsel(token)
    ]);
    const employees = directory
      .filter(
        (employee) =>
          employee.active !== false &&
          employee.email.trim() &&
          employee.email.trim().toLowerCase() !== email
      )
      .map((employee) => ({
        name: employee.name,
        email: employee.email.trim().toLowerCase(),
        phone: staffPhoneForReminders(employee),
        kind: "staff" as const
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const counsel = counselDirectory
      .filter(isMessengerCollaboratingCounsel)
      .map((row) => ({
        name: row.name,
        email: row.email.trim().toLowerCase(),
        phone: row.phone.trim(),
        firm: row.firm.trim(),
        kind: "counsel" as const
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      isAdmin,
      canCompose: true,
      inbox: inbox.map(serializeMessage),
      sent: sent.map(serializeMessage),
      unreadCount: countUnreadMessages(inbox),
      employees,
      counsel
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not load staff messages.";
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
    const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const messageBody = String(body.body || "").trim();
    const sendWhatsApp = body.sendWhatsApp === true;

    const token = await requireSessionAccessToken();
    const [directory, counselDirectory] = await Promise.all([
      getEmployeeDirectory(token),
      listExternalCounsel(token)
    ]);
    const employee = resolveEmployeeRecipient(directory, recipientEmail);
    const counsel =
      employee && employee.active !== false && employee.email.trim()
        ? null
        : resolveCounselRecipient(counselDirectory, recipientEmail);

    if (!employee && !counsel) {
      return NextResponse.json(
        {
          error:
            "Recipient not found. Choose active staff, or collaborating counsel with an email on file."
        },
        { status: 400 }
      );
    }
    if (employee && employee.active === false) {
      return NextResponse.json({ error: "That staff recipient is inactive." }, { status: 400 });
    }

    const recipientKind = employee ? ("staff" as const) : ("counsel" as const);
    const toEmail = (employee?.email || counsel?.email || "").trim().toLowerCase();
    const toName = (employee?.name || counsel?.name || "").trim();
    const recipientPhone = employee
      ? staffPhoneForReminders(employee)
      : String(counsel?.phone || "").trim();

    const fromName =
      formatStaffDisplayName(session?.user?.name, email) || session?.user?.name?.trim() || email;

    const message = await appendStaffMessage(token, {
      fromEmail: email,
      fromName,
      toEmail,
      toName,
      subject,
      body: messageBody,
      whatsAppSent: sendWhatsApp
    });

    const phoneDigits = normalizeStaffPhoneE164(recipientPhone);
    let whatsAppUrl: string | null | undefined;
    if (sendWhatsApp) {
      if (recipientKind === "counsel") {
        whatsAppUrl = phoneDigits
          ? whatsAppShareUrl(counselMessageWhatsAppText(message), phoneDigits)
          : null;
      } else {
        whatsAppUrl = phoneDigits ? staffMessageWhatsAppUrl(message, recipientPhone) : null;
      }
    }

    const mailtoUrl =
      recipientKind === "counsel" ? staffMessageMailtoUrl(message, toEmail) : undefined;

    return NextResponse.json({
      message: serializeMessage(message),
      recipientKind,
      mailtoUrl,
      whatsAppUrl,
      whatsAppMissingPhone: sendWhatsApp && !phoneDigits
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not send staff message.";
    const status =
      message.includes("Unauthorized") || message.includes("sign in")
        ? 401
        : message.includes("required") || message.includes("must be") || message.includes("cannot message")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function serializeMessage(message: {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  readAt: string | null;
  whatsAppSent: boolean;
}) {
  return {
    id: message.id,
    sentAt: message.sentAt,
    fromEmail: message.fromEmail,
    fromName: message.fromName,
    toEmail: message.toEmail,
    toName: message.toName,
    subject: message.subject,
    body: message.body,
    readAt: message.readAt,
    whatsAppSent: message.whatsAppSent
  };
}
