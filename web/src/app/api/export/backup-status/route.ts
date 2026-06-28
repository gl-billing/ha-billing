import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminEmail } from "@/lib/admin";
import { getLastPdfBackupAt } from "@/lib/sheets/backup-settings";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const lastBackupAt = await getLastPdfBackupAt(accessToken);
    return NextResponse.json({ lastBackupAt });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to read backup status.";
    const status = message.includes("Forbidden") || message.includes("Admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
