import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { formatPeso, toCsvRow } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getArAgingReport } from "@/lib/sheets/reports";

export async function GET() {
  try {
    const accessToken = await requireSessionAccessToken();
    const report = await getArAgingReport(accessToken);

    const all = [
      ...report.buckets.current,
      ...report.buckets["31-60"],
      ...report.buckets["61-90"],
      ...report.buckets["90+"]
    ];

    const header = toCsvRow([
      "Client Code",
      "Client Name",
      "Case Title",
      "Balance",
      "Days Past Due",
      "Aging Bucket",
      "Last Billing Date",
      "Account Status"
    ]);

    const rows = all.map((e) =>
      toCsvRow([
        e.code,
        e.name,
        e.caseTitle,
        formatPeso(e.balance),
        e.daysPastDue,
        e.bucket,
        e.lastBillingDate,
        e.accountStatus
      ])
    );

    const csv = [header, ...rows].join("\n");
    const filename = `gl-ar-aging-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
