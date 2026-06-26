import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { formatPeso, toCsvRow } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage, withCache } from "@/lib/sheets/cache";
import { getClients } from "@/lib/sheets/master";

export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { searchParams } = new URL(request.url);
    const includeClosed = searchParams.get("includeClosed") === "1";

    const clients = await withCache(
      accessToken,
      includeClosed ? "clients-all" : "clients",
      60_000,
      () => getClients(accessToken, { includeClosed })
    );

    const header = toCsvRow([
      "Client Code",
      "Client Name",
      "Case Title",
      "Case Number",
      "Balance",
      "Status",
      "Account Status",
      "Email",
      "Phone",
      "Assigned Attorney",
      "Retainer",
      "Last SOA"
    ]);

    const rows = clients.map((c) =>
      toCsvRow([
        c.code,
        c.name,
        c.caseTitle,
        c.caseNumber || "",
        formatPeso(c.balance),
        c.status,
        c.accountStatus,
        c.email,
        c.phone || "",
        c.assignedAttorney || "",
        c.retainerBalance || 0,
        c.soaSent || ""
      ])
    );

    const csv = [header, ...rows].join("\n");
    const filename = `gl-clients-${new Date().toISOString().slice(0, 10)}.csv`;

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
