import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { closeLinkedPrepTasksForEvent } from "@/lib/office-tasks/prep-completion";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { setEventSubmitted } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      submitted?: boolean;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : null;
    const rowNumber = Number(body.rowNumber);
    const submitted = body.submitted !== false;

    if (source !== "Event" || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "Event rowNumber is required." }, { status: 400 });
    }

    const items = await collectAllItems(token);
    const item =
      items.find((row) => row.source === "Event" && row.rowNumber === rowNumber) ||
      (body.itemId ? items.find((row) => row.id === body.itemId) : undefined);

    await setEventSubmitted(token, rowNumber, submitted);

    let extraMessage = "";
    if (submitted && item?.source === "Event") {
      const closed = await closeLinkedPrepTasksForEvent(token, item.id, rowNumber);
      if (closed > 0) {
        extraMessage = ` Closed ${closed} linked prep task${closed === 1 ? "" : "s"}.`;
      }
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: submitted ? "done" : "reopen",
      source: "Event",
      itemId: body.itemId ? String(body.itemId) : item?.id || "",
      clientCase: body.clientCase ? String(body.clientCase) : item?.clientCase || "",
      summary: submitted ? "Filing marked submitted" : "Filing submission cleared"
    });

    return NextResponse.json({
      ok: true,
      message: `${submitted ? "Marked as filed / submitted." : "Submission status cleared."}${extraMessage}`
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
