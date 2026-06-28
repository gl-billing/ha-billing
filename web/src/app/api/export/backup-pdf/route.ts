import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminEmail } from "@/lib/admin";
import { buildIncrementalBackupPdf } from "@/lib/billing-document-pdf/backup-pdf";
import {
  getLastPdfBackupAt,
  parseBackupTimestamp,
  setLastPdfBackupAt
} from "@/lib/sheets/backup-settings";
import { getIncrementalBackupRows } from "@/lib/sheets/incremental-backup-data";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

function formatBackupLabel(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const lastBackupAt = await getLastPdfBackupAt(accessToken);
    const sinceMs = parseBackupTimestamp(lastBackupAt);
    const generatedAt = new Date();
    const rows = await getIncrementalBackupRows(accessToken, sinceMs);

    const pdf = await buildIncrementalBackupPdf({
      rows,
      generatedAt,
      sinceLabel: formatBackupLabel(lastBackupAt, "Beginning of records"),
      untilLabel: formatBackupLabel(generatedAt.toISOString(), generatedAt.toLocaleString())
    });

    await setLastPdfBackupAt(accessToken, generatedAt.toISOString());

    const stamp = generatedAt.toISOString().slice(0, 10);
    const filename = `ha-billing-backup-${stamp}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Backup export failed.";
    const status = message.includes("Forbidden") || message.includes("Admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
