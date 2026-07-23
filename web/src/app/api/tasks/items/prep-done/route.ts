import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { formatStaffDisplayName } from "@/lib/user-display";
import { recordPrepReadyState } from "@/lib/office-tasks/prep-completion";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
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

    const parsed = parseOfficeItemMutationInput(body, { taskOnly: true });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(token, parsed.source, {
      itemId: parsed.itemId,
      rowNumber: parsed.rowNumber
    });
    if (!target) {
      return NextResponse.json({ error: "Could not find this task in the spreadsheet." }, { status: 404 });
    }

    const items = await collectAllItems(token);
    const item =
      target.item ||
      items.find((row) => row.source === "Task" && row.id === target.itemId) ||
      items.find((row) => row.source === "Task" && row.rowNumber === target.rowNumber);

    if (!item || item.source !== "Task") {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const actor =
      formatStaffDisplayName(session?.user?.name, session?.user?.email) ||
      session?.user?.email ||
      "Staff";

    const updated = await recordPrepReadyState(token, item, actor, items);
    if (!updated) {
      return NextResponse.json(
        { error: "Could not mark prep done — link this task to an open filing event first." },
        { status: 400 }
      );
    }

    invalidateTasksDataCache(token);

    void appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "prep-ready",
      source: "Task",
      itemId: target.itemId || item.id,
      clientCase: body.clientCase ? String(body.clientCase) : item.clientCase || "",
      summary: "Filing prep marked done — awaiting filing event"
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      prepReady: true,
      remarks: updated.taskRemarks,
      nextAction: updated.taskNextAction,
      message: "Prep marked done. The linked filing event was notified — both will complete when filing is confirmed."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
