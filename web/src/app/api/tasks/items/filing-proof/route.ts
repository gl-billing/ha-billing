import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { markFilingProofComplete } from "@/lib/office-tasks/filing-submitted-follow-up";
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
    requireAdminEmail(session?.user?.email);

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
    if (!target?.item || target.item.source !== "Event") {
      return NextResponse.json({ error: "Could not find this event in the spreadsheet." }, { status: 404 });
    }

    const item = target.item;
    const marked = await markFilingProofComplete(token, item);
    if (!marked) {
      return NextResponse.json({ error: "Proof already recorded or event not found." }, { status: 400 });
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "filing.proof.done",
      source: "Event",
      itemId: item.id,
      clientCase: body.clientCase || item.clientCase,
      summary: "Filing proof marked complete"
    });

    return NextResponse.json({ ok: true, message: "Filing proof marked complete." });
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
