import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { updateItemNextAction } from "@/lib/office-tasks/sheets/complete";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      nextAction?: string;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);
    const nextAction = String(body.nextAction ?? "").trim();

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source (Task|Event) and rowNumber are required." }, { status: 400 });
    }

    if (!nextAction) {
      return NextResponse.json({ error: "nextAction is required." }, { status: 400 });
    }

    await updateItemNextAction(token, source, rowNumber, nextAction);
    invalidateTasksDataCache(token);

    const session = await getServerSession(authOptions);
    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "next-action",
      source,
      itemId: body.itemId ? String(body.itemId) : "",
      clientCase: body.clientCase ? String(body.clientCase) : "",
      summary: "Next action updated",
      details: nextAction
    });

    return NextResponse.json({ ok: true, message: "Next action saved." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save next action.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
