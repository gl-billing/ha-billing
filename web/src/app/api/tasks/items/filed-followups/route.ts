import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { createServingTaskAfterFiled } from "@/lib/office-tasks/filing-serving-after-filed";
import { resolveOfficeItemForMutation } from "@/lib/office-tasks/sheets/resolve-item-row";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

/**
 * Post–Mark filed Serving task (idempotent).
 * Client notice already runs in /api/tasks/items/submitted for HA.
 */
export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const body = (await request.json()) as {
      source?: string;
      rowNumber?: number;
      itemId?: string;
    };

    if (body.source !== "Event") {
      return NextResponse.json({ error: "Event source is required." }, { status: 400 });
    }

    const itemId = body.itemId ? String(body.itemId).trim() : "";
    const rowNumber = Number(body.rowNumber);
    if (!itemId && (!rowNumber || rowNumber < 2)) {
      return NextResponse.json({ error: "itemId or rowNumber is required." }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(token, "Event", { itemId, rowNumber });
    if (!target?.item || target.item.source !== "Event") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    let serving: { ok: true; created: boolean; taskId: string | null } | { ok: false; error: string };
    try {
      const result = await createServingTaskAfterFiled(token, target.item);
      serving = { ok: true, created: result.created, taskId: result.taskId };
      if (result.created) invalidateTasksDataCache(token);
    } catch (error) {
      serving = {
        ok: false,
        error: error instanceof Error ? error.message : "Serving task failed to create."
      };
    }

    const warn = serving.ok ? null : `Filed — Serving task failed to create.`;
    return NextResponse.json({
      ok: !warn,
      serving,
      notice: { ok: true, message: null },
      warn
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Follow-up automations failed.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("firm admins")
        ? 403
        : 500;
    return NextResponse.json({ error: message, warn: `Filed — ${message}` }, { status });
  }
}
