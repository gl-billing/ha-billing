import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { formatStaffDisplayName } from "@/lib/user-display";
import { recordLetterDocReadyState } from "@/lib/office-tasks/letter-completion";
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

    const parsed = parseOfficeItemMutationInput(body, { taskOnly: true });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(token, parsed.source, {
      itemId: parsed.itemId,
      rowNumber: parsed.rowNumber
    });
    if (!target?.item || target.item.source !== "Task") {
      return NextResponse.json({ error: "Could not find this task in the spreadsheet." }, { status: 404 });
    }

    const item = target.item;
    const actor =
      formatStaffDisplayName(session?.user?.name, session?.user?.email) ||
      session?.user?.email ||
      "Staff";

    const result = await recordLetterDocReadyState(token, item, actor);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Could not mark document ready — link this draft to an open serve task first." },
        { status: 400 }
      );
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "letter-doc-ready",
      source: "Task",
      itemId: item.id,
      clientCase: body.clientCase ? String(body.clientCase) : item.clientCase || "",
      summary: "Letter draft marked ready — liaison notified"
    });

    return NextResponse.json({
      ok: true,
      docReady: true,
      whatsAppUrl: result.whatsAppUrl,
      message:
        "Document marked ready. Serve task moved to In Progress — WhatsApp nudge opened for the liaison."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
