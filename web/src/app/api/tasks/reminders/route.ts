import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/office-tasks/admin";
import { callTasksAppsScript } from "@/lib/office-tasks/apps-script";
import {
  accessTokenHasGmailSend,
  getGmailSenderAddress,
  gmailPermissionHelp
} from "@/lib/office-tasks/gmail-send";
import type { ReminderScope } from "@/lib/office-tasks/reminders";
import {
  sendAllStaffReminderEmails,
  sendStaffReminderEmail,
  sendTestReminderEmail
} from "@/lib/office-tasks/send-staff-reminders";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { canonicalizeStaffName } from "@/lib/staff-assignee";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const SCOPES: ReminderScope[] = ["daily", "overdue", "both"];

function useAppsScriptBridge(): boolean {
  return process.env.TASKS_REMINDERS_VIA_APPS_SCRIPT === "true";
}

function appsScriptConfigured(): boolean {
  return Boolean(
    process.env.TASKS_APPS_SCRIPT_WEB_APP_URL?.trim() &&
      process.env.TASKS_APPS_SCRIPT_WEB_APP_SECRET?.trim()
  );
}

async function sendViaAppsScript(body: {
  assignee?: string;
  scope: ReminderScope;
  allStaff?: boolean;
}) {
  if (body.allStaff) {
    const result = await callTasksAppsScript("sendAllStaffReminders", { scope: body.scope });
    return NextResponse.json({
      ok: true,
      message: result.message || "Reminders sent.",
      sent: (result as { sent?: number }).sent,
      skipped: (result as { skipped?: number }).skipped
    });
  }

  const assignee = body.assignee?.trim();
  if (!assignee) {
    return NextResponse.json({ error: "Assignee name is required." }, { status: 400 });
  }

  const result = await callTasksAppsScript("sendStaffReminder", { assignee, scope: body.scope });
  return NextResponse.json({
    ok: true,
    message: result.message || "Reminder sent.",
    skipped: (result as { skipped?: boolean }).skipped
  });
}

async function sendViaGmail(
  body: {
    assignee?: string;
    scope: ReminderScope;
    allStaff?: boolean;
    testToSelf?: boolean;
  },
  senderEmail: string
) {
  const accessToken = await requireSessionAccessToken();

  const hasGmail = await accessTokenHasGmailSend(accessToken);
  if (!hasGmail) {
    return NextResponse.json({ error: gmailPermissionHelp() }, { status: 403 });
  }

  const [items, directory] = await Promise.all([
    collectAllItems(accessToken),
    getEmployeeDirectory(accessToken)
  ]);
  const today = todayYmd();
  const roster = directory.map((employee) => employee.name).filter(Boolean);

  if (body.testToSelf) {
    const assignee = body.assignee?.trim() || directory[0]?.name || "Staff";
    const canonicalAssignee = canonicalizeStaffName(assignee, roster);
    const emp =
      directory.find((e) => e.name.toLowerCase() === canonicalAssignee.toLowerCase()) || directory[0];
    if (!emp) {
      return NextResponse.json(
        { error: "Add at least one employee on the Employees sheet before sending a test." },
        { status: 400 }
      );
    }
    const result = await sendTestReminderEmail(
      accessToken,
      senderEmail,
      emp.name,
      emp.email,
      items,
      today,
      body.scope,
      roster
    );
    return NextResponse.json({
      ok: true,
      message: result.message,
      sent: 1,
      test: true
    });
  }

  if (body.allStaff) {
    const result = await sendAllStaffReminderEmails(
      accessToken,
      senderEmail,
      directory,
      items,
      today,
      body.scope
    );
    const status = result.sent && result.sent > 0 ? 200 : result.errors?.length ? 400 : 200;
    return NextResponse.json(
      {
        ok: Boolean(result.sent && result.sent > 0),
        message: result.message,
        sent: result.sent,
        skipped: result.skippedCount,
        details: result.details,
        via: "gmail"
      },
      { status }
    );
  }

  const assignee = body.assignee?.trim();
  if (!assignee) {
    return NextResponse.json({ error: "Assignee name is required." }, { status: 400 });
  }

  const canonicalAssignee = canonicalizeStaffName(assignee, roster);
  const emp = directory.find((e) => e.name.toLowerCase() === canonicalAssignee.toLowerCase());
  if (!emp) {
    return NextResponse.json({ error: `No active employee found with name: ${assignee}` }, { status: 400 });
  }

  const result = await sendStaffReminderEmail(
    accessToken,
    senderEmail,
    emp.name,
    emp.email,
    items,
    today,
    body.scope,
    roster
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: !result.skipped,
    message: result.message,
    skipped: result.skipped,
    sent: result.skipped ? 0 : 1
  });
}

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const hasGmail = await accessTokenHasGmailSend(accessToken);
    let gmailSender: string | null = null;
    if (hasGmail) {
      try {
        gmailSender = await getGmailSenderAddress(
          accessToken,
          session?.user?.email || undefined
        );
      } catch {
        gmailSender = session?.user?.email || null;
      }
    }

    return NextResponse.json({
      ok: true,
      sessionEmail: session?.user?.email || null,
      gmailSenderEmail: gmailSender,
      gmailSendReady: hasGmail && Boolean(gmailSender),
      via: useAppsScriptBridge() ? "apps-script" : "gmail",
      hint: hasGmail
        ? gmailSender
          ? `Reminders send from ${gmailSender}. You get a BCC copy; staff get the To address. Check Sent in Gmail.`
          : "Gmail permission looks present but the sender account could not be read. Sign in again."
        : gmailPermissionHelp()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check reminder setup.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: "Only admins can send staff reminder emails." }, { status: 403 });
    }

    if (!email) {
      return NextResponse.json({ error: "Signed-in email is required to send reminders." }, { status: 400 });
    }

    const body = (await request.json()) as {
      assignee?: string;
      scope?: ReminderScope;
      allStaff?: boolean;
      testToSelf?: boolean;
    };

    const scope = body.scope || "both";
    if (!SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope. Use daily, overdue, or both." }, { status: 400 });
    }

    const payload = {
      assignee: body.assignee,
      scope,
      allStaff: body.allStaff,
      testToSelf: body.testToSelf
    };

    if (useAppsScriptBridge()) {
      return await sendViaAppsScript(payload);
    }

    try {
      return await sendViaGmail(payload, email);
    } catch (gmailError) {
      const message = gmailError instanceof Error ? gmailError.message : "Reminder failed.";
      if (message.includes("Gmail") && appsScriptConfigured()) {
        return await sendViaAppsScript(payload);
      }
      throw gmailError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder failed.";
    const status = message.includes("not configured")
      ? 503
      : message.includes("Unauthorized")
        ? 401
        : message.includes("Gmail") || message.includes("permission")
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
