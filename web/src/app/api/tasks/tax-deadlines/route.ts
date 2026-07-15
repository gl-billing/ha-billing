import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { buildTaxDeadlineViews, buildTaxEventPayload } from "@/lib/tax-deadlines";
import { seedUpcomingBirDeadlines } from "@/lib/tax-deadlines-autopilot";
import { appendEvent } from "@/lib/office-tasks/sheets/tasks";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { defaultTaxComplianceAssignee } from "@/lib/office-tasks/task-assignees";

export async function GET() {
  try {
    await requireSessionAccessToken();
    const deadlines = buildTaxDeadlineViews();
    const groups = ["Monthly", "Quarterly", "Annual"] as const;
    return NextResponse.json({ deadlines, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tax deadlines.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      action?: string;
      deadlineIndex?: number;
      filingDate?: string;
      clientCase?: string;
      responsible?: string;
      priority?: string;
      reminderDays?: number;
      calendarSync?: boolean;
      horizonDays?: number;
    };

    if (body.action === "seedAutopilot") {
      if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: "Admin only." }, { status: 403 });
      }

      const result = await seedUpcomingBirDeadlines(token, {
        responsible: body.responsible,
        horizonDays: body.horizonDays
      });

      return NextResponse.json({
        ok: true,
        message:
          result.created > 0
            ? `Created ${result.created} BIR deadline(s). Skipped ${result.skipped} duplicate(s).`
            : `No new deadlines — ${result.skipped} already on the calendar.`,
        ...result
      });
    }

    const index = Number(body.deadlineIndex);
    const roster = await getActiveEmployeeNames(token);
    const responsible = body.responsible?.trim() || defaultTaxComplianceAssignee(roster);
    const payload = buildTaxEventPayload(index, {
      filingDate: String(body.filingDate || ""),
      clientCase: body.clientCase,
      responsible,
      priority: body.priority,
      reminderDays: Number(body.reminderDays ?? 1),
      calendarSync: body.calendarSync
    });

    await appendEvent(token, payload);

    return NextResponse.json({
      ok: true,
      message: `Tax deadline added: ${payload.details} (due ${payload.filingDeadline})`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add tax deadline.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
