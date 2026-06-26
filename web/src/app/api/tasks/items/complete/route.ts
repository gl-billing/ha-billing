import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { formatStaffDisplayName } from "@/lib/user-display";
import {
  closeLinkedPrepTasksForEvent,
  isPreparationTask,
  recordPrepDoneNoticeOnLinkedEvent
} from "@/lib/office-tasks/prep-completion";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      done?: boolean;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);
    const done = body.done !== false;

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source (Task|Event) and rowNumber are required." }, { status: 400 });
    }

    const items = await collectAllItems(token);
    const item =
      items.find((row) => row.source === source && row.rowNumber === rowNumber) ||
      (body.itemId ? items.find((row) => row.id === body.itemId) : undefined);

    if (source === "Event") {
      requireAdminEmail(session?.user?.email);
    }

    await setItemDone(token, source, rowNumber, done);

    let extraMessage = "";
    if (source === "Event" && done && item?.source === "Event") {
      const closed = await closeLinkedPrepTasksForEvent(token, item.id, rowNumber);
      if (closed > 0) {
        extraMessage = ` Closed ${closed} linked prep task${closed === 1 ? "" : "s"}.`;
      }
    }

    if (source === "Task" && done && item?.source === "Task" && isPreparationTask(item)) {
      const actor =
        formatStaffDisplayName(session?.user?.name, session?.user?.email) ||
        session?.user?.email ||
        "Staff";
      const notified = await recordPrepDoneNoticeOnLinkedEvent(token, item, actor);
      if (notified) {
        extraMessage = " Admin notified on the linked filing event.";
      }
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: done ? "done" : "reopen",
      source,
      itemId: body.itemId ? String(body.itemId) : item?.id || "",
      clientCase: body.clientCase ? String(body.clientCase) : item?.clientCase || "",
      summary: done ? `${source} marked done` : `${source} reopened`
    });

    return NextResponse.json({
      ok: true,
      message: `${done ? `${source} marked done.` : `${source} reopened.`}${extraMessage}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("firm admins")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
