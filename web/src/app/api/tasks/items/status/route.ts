import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { resetItemWithNewDate, setItemStatus, type ItemStatusUpdate } from "@/lib/office-tasks/sheets/complete";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { isDeadlineLike } from "@/lib/office-tasks/schedule";

const ALLOWED: ItemStatusUpdate[] = ["Cancelled", "Reset", "restore", "Started", "Waiting", "In Progress"];

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      status?: string;
      note?: string;
      newDate?: string;
      category?: string;
      hasFilingDeadline?: boolean;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);
    const status = body.status as ItemStatusUpdate;

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source (Task|Event) and rowNumber are required." }, { status: 400 });
    }

    if (!status || !ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: "status must be Cancelled, Reset, restore, Started, Waiting, or In Progress." },
        { status: 400 }
      );
    }

    if (status === "Reset" && body.newDate?.trim()) {
      const useFilingDeadline =
        source === "Event" && isDeadlineLike({ category: String(body.category || "") });
      const hasFilingDeadline = body.hasFilingDeadline === true;
      await resetItemWithNewDate(token, source, rowNumber, body.newDate.trim(), {
        useFilingDeadline,
        hasFilingDeadline,
        category: String(body.category || "")
      });
      invalidateTasksDataCache(token);
      const prepNote =
        source === "Event" && (useFilingDeadline || hasFilingDeadline)
          ? " Linked filing prep tasks were reopened with updated due dates."
          : "";
      return NextResponse.json({
        ok: true,
        message: `${source} reset with new date ${body.newDate.trim()}.${prepNote}`
      });
    }

    if (status === "Reset") {
      return NextResponse.json({ error: "newDate is required when resetting." }, { status: 400 });
    }

    const saved = await setItemStatus(token, source, rowNumber, status, {
      note: typeof body.note === "string" ? body.note : undefined
    });
    invalidateTasksDataCache(token);

    const session = await getServerSession(authOptions);
    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "status",
      source,
      itemId: body.itemId ? String(body.itemId) : "",
      clientCase: body.clientCase ? String(body.clientCase) : "",
      summary: `${source} → ${saved.status}`,
      details:
        status === "restore"
          ? "Restored to active"
          : typeof body.note === "string" && body.note.trim()
            ? body.note.trim()
            : undefined
    });

    const label =
      status === "restore" ? `${source} restored to active.` : `${source} marked ${saved.status}.`;

    return NextResponse.json({ ok: true, message: label, status: saved.status, remarks: saved.remarks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status update failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
