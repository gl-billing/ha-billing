import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { deleteOfficeItemsPermanently } from "@/lib/office-tasks/sheets/delete-items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source (Task|Event) and rowNumber are required." }, { status: 400 });
    }

    const removed = await deleteOfficeItemsPermanently(token, [{ source, rowNumber }]);
    if (removed < 1) {
      return NextResponse.json({ error: "Could not delete this item from the spreadsheet." }, { status: 400 });
    }

    invalidateTasksDataCache(token);

    const session = await getServerSession(authOptions);
    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "delete",
      source,
      itemId: body.itemId ? String(body.itemId) : "",
      clientCase: body.clientCase ? String(body.clientCase) : "",
      summary: `${source} deleted permanently`
    });

    return NextResponse.json({
      ok: true,
      message: `${source === "Task" ? "Task" : "Event"} deleted permanently.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete item.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
