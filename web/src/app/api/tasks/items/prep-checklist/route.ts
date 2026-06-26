import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { mutateItemPrepChecklist, updateItemPrepChecklistItem } from "@/lib/office-tasks/sheets/complete";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

function parseMutation(body: Record<string, unknown>): PrepChecklistMutation | null {
  const action = String(body.action || "").trim();
  if (action === "add") {
    const label = String(body.label || "").trim();
    if (!label) return null;
    return { action: "add", label };
  }
  if (action === "edit") {
    const label = String(body.label || "").trim();
    const itemIndex = Number(body.itemIndex);
    if (!label || !Number.isInteger(itemIndex) || itemIndex < 0) return null;
    return { action: "edit", itemIndex, label };
  }
  if (action === "remove") {
    const itemIndex = Number(body.itemIndex);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) return null;
    return { action: "remove", itemIndex };
  }
  if (action === "delete") {
    return { action: "delete" };
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      itemIndex?: number;
      checked?: boolean;
      action?: string;
      label?: string;
      itemId?: string;
      clientCase?: string;
    };

    const source = body.source === "Event" ? "Event" : body.source === "Task" ? "Task" : null;
    const rowNumber = Number(body.rowNumber);

    if (!source || !rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "source Task or Event and rowNumber are required." }, { status: 400 });
    }

    const mutation = parseMutation(body);
    const session = await getServerSession(authOptions);

    if (mutation) {
      const result = await mutateItemPrepChecklist(token, source, rowNumber, mutation);
      invalidateTasksDataCache(token);

      const summary =
        mutation.action === "add"
          ? "Prep checklist item added"
          : mutation.action === "edit"
            ? "Prep checklist item edited"
            : mutation.action === "delete"
              ? "Prep checklist deleted"
              : "Prep checklist item removed";

      await appendTaskActivity(token, {
        user: session?.user?.email || session?.user?.name || "staff",
        action: "prep-checklist",
        source,
        itemId: body.itemId ? String(body.itemId) : "",
        clientCase: body.clientCase ? String(body.clientCase) : "",
        summary,
        details:
          mutation.action === "delete"
            ? "Checklist removed"
            : `${result.done}/${result.total} complete`
      });

      return NextResponse.json({
        ok: true,
        message: mutation.action === "delete" ? "Prep checklist deleted." : "Prep checklist updated.",
        ...result
      });
    }

    const itemIndex = Number(body.itemIndex);
    const checked = body.checked === true;

    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return NextResponse.json({ error: "itemIndex is required." }, { status: 400 });
    }

    const result = await updateItemPrepChecklistItem(token, source, rowNumber, itemIndex, checked);
    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "prep-checklist",
      source,
      itemId: body.itemId ? String(body.itemId) : "",
      clientCase: body.clientCase ? String(body.clientCase) : "",
      summary: checked ? "Prep item checked" : "Prep item unchecked",
      details: `${result.done}/${result.total} complete`
    });

    return NextResponse.json({
      ok: true,
      message: "Prep checklist updated.",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update prep checklist.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
