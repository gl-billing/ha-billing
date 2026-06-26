import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { markCourtConfirmed } from "@/lib/hearing-escalation";
import { getSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { SHEETS } from "@/lib/tasks-config";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as { source?: string; rowNumber?: number };

    if (body.source !== "Event") {
      return NextResponse.json({ error: "Court confirmation applies to hearings (events) only." }, { status: 400 });
    }

    const rowNumber = Number(body.rowNumber);
    if (!rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "rowNumber is required." }, { status: 400 });
    }

    const remarksCol = "R";
    const range = toA1Range(SHEETS.events, `${remarksCol}${rowNumber}`);
    const rows = await getSheetValues(token, range);
    const current = String(rows[0]?.[0] ?? "");
    const next = markCourtConfirmed(current);

    await updateSheetValues(token, range, [[next]]);
    invalidateTasksDataCache(token);

    return NextResponse.json({
      ok: true,
      message: "Court confirmed — hearing marked for Andrea workflow.",
      confirmedBy: session?.user?.email || session?.user?.name || "staff"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark court confirmed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
