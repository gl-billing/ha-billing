import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { runCourtConfirmedAutomations } from "@/lib/office-tasks/court-confirmed-automation";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import {
  parseOfficeItemMutationInput,
  resolveOfficeItemForMutation
} from "@/lib/office-tasks/sheets/resolve-item-row";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      itemId?: string;
      id?: string;
      clientCase?: string;
    };

    const parsed = parseOfficeItemMutationInput(body, { eventOnly: true });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(token, parsed.source, {
      itemId: parsed.itemId,
      rowNumber: parsed.rowNumber
    });
    if (!target) {
      return NextResponse.json({ error: "Could not find this hearing in the spreadsheet." }, { status: 404 });
    }

    const actor = session?.user?.email || session?.user?.name || "staff";
    const event = target.item;
    if (!event || event.source !== "Event") {
      return NextResponse.json({ error: "Could not find this hearing in the spreadsheet." }, { status: 404 });
    }
    const automation = await runCourtConfirmedAutomations(
      token,
      { ...event, rowNumber: target.rowNumber },
      actor
    );
    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: actor,
      action: "status",
      source: "Event",
      itemId: target.itemId || parsed.itemId,
      clientCase: body.clientCase ? String(body.clientCase) : target.item?.clientCase || "",
      summary: "Court confirmed",
      details: automation.messages.join(" · ") || "Hearing marked court-confirmed."
    });

    const extra = automation.messages.length ? ` ${automation.messages.join(" ")}` : "";
    return NextResponse.json({
      ok: true,
      message: `Court confirmed.${extra}`,
      confirmedBy: actor
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark court confirmed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
