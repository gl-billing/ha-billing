import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { renameTaskSourceIdsForClientCode } from "@/lib/office-tasks/sheets/rename-client-code";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { renameClientCode } from "@/lib/sheets/client-rename";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    requireAdminEmail(email);

    const { code } = await context.params;
    const oldCode = sanitizeSheetName(decodeURIComponent(code));
    const body = (await request.json()) as { newCode?: string; confirmCode?: string };
    const newCode = sanitizeSheetName(String(body.newCode || "").trim());
    const confirmCode = String(body.confirmCode || "").trim();

    if (!newCode) {
      return NextResponse.json({ error: "New client code is required." }, { status: 400 });
    }

    if (confirmCode !== oldCode) {
      return NextResponse.json(
        { error: "Confirmation failed. Type the current client code to rename." },
        { status: 400 }
      );
    }

    const billingResult = await renameClientCode(accessToken, oldCode, newCode);
    const taskResult = await renameTaskSourceIdsForClientCode(accessToken, oldCode, newCode);

    await appendAuditLog(accessToken, {
      user: email || "unknown",
      action: "client.rename",
      clientCode: billingResult.newCode,
      summary: `Client code renamed ${billingResult.oldCode} → ${billingResult.newCode}`,
      details:
        taskResult.tasks || taskResult.events
          ? `Updated ${taskResult.tasks} task ID(s) and ${taskResult.events} event ID(s).`
          : "No matching task or event IDs updated."
    });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, "sheet-titles");
    invalidateCache(accessToken, `profile:${billingResult.oldCode}`);
    invalidateCache(accessToken, `profile:${billingResult.newCode}`);

    return NextResponse.json({
      ...billingResult,
      tasksUpdated: taskResult.tasks,
      eventsUpdated: taskResult.events,
      message:
        taskResult.tasks || taskResult.events
          ? `${billingResult.message} Updated ${taskResult.tasks} task ID(s) and ${taskResult.events} event ID(s).`
          : billingResult.message
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to rename client code.";
    const status =
      message.includes("ADMIN_EMAILS") || message.includes("firm admins") || message.startsWith("Unauthorized")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
