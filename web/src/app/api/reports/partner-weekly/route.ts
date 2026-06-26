import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminEmail } from "@/lib/admin";
import { buildPartnerWeeklyReport, formatPartnerWeeklyReportHtml } from "@/lib/sheets/partner-weekly";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const today = new Date().toISOString().slice(0, 10);
    const report = await buildPartnerWeeklyReport(accessToken, today);
    return NextResponse.json({ report });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to build report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as { recipients?: string[] };
    const today = new Date().toISOString().slice(0, 10);
    const report = await buildPartnerWeeklyReport(accessToken, today);
    const html = formatPartnerWeeklyReportHtml(report);

    const recipients =
      body.recipients?.filter(Boolean) ||
      process.env.PARTNER_REPORT_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ||
      [];

    if (!recipients.length) {
      return NextResponse.json(
        { error: "No recipients. Set PARTNER_REPORT_EMAILS or pass recipients in the request body." },
        { status: 400 }
      );
    }

    for (const to of recipients) {
      await sendHtmlEmailViaGmail({
        accessToken,
        fromEmail: session?.user?.email || undefined,
        to,
        subject: `Weekly partner report — ${report.weekLabel}`,
        html
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Weekly report emailed to ${recipients.length} recipient(s).`,
      report
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to send report.";
    const status = message.includes("ADMIN_EMAILS") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
