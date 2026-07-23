import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessBilling } from "@/lib/app-access";
import { buildDeskConnectors } from "@/lib/integrations/build-desk-status";
import { DESK_CONNECTOR_IDS } from "@/lib/integrations/desk-connectors";
import { buildClioHref } from "@/lib/clio/workspace-nav";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!canAccessBilling(email)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  let accessToken: string;
  try {
    accessToken = await requireSessionAccessToken();
  } catch {
    return NextResponse.json({ error: "Could not access firm data." }, { status: 503 });
  }

  const connectors = await buildDeskConnectors({
    accessToken,
    sessionEmail: email,
    settingsHref: buildClioHref("settings", "firm"),
    calendarHref: buildClioHref("calendar", "month"),
    reportsHref: buildClioHref("reports", "reports"),
    loginHref: "/login?switch=1"
  });

  const list = DESK_CONNECTOR_IDS.map((id) => connectors[id]);
  const allOk = list.every((row) => row.ok || !row.configured);

  return NextResponse.json({
    overall: list.some((row) => row.status === "error")
      ? "error"
      : allOk
        ? "ok"
        : "warn",
    connectors,
    checklist: Object.fromEntries(
      list.map((row) => [
        row.id,
        { status: row.status, message: row.message, ok: row.ok, configured: row.configured }
      ])
    )
  });
}
