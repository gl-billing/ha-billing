import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  logAppearanceOutcome,
  logHearingOutcome,
  type AppearanceOutcomeAction,
  type HearingOutcomeAction
} from "@/lib/office-tasks/appearance-outcome";
import type { AppearanceCourtFollowUpKind } from "@/lib/office-tasks/appearance-outcome-shared";
import { sendClientEventClosedNotice } from "@/lib/office-tasks/client-event-notices";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import {
  parseOfficeItemMutationInput,
  resolveOfficeItemForMutation
} from "@/lib/office-tasks/sheets/resolve-item-row";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

const APPEARANCE_ACTIONS: AppearanceOutcomeAction[] = ["completed", "rescheduled", "postponed", "cancelled"];
const LEGACY_ACTIONS: HearingOutcomeAction[] = ["appeared", "continued", "cancelled"];

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
      action?: string;
      nextHearingDate?: string;
      nextDate?: string;
      note?: string;
      whatHappened?: string;
      createNextDateFollowUp?: boolean;
      courtFollowUpKind?: string;
      followUpDate?: string;
      followUpNote?: string;
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
    const action = String(body.action || "").trim();
    const whatHappened = String(body.whatHappened || body.note || "").trim();
    const nextDate = String(body.nextDate || body.nextHearingDate || "").trim();

    // Legacy post-hearing warning payload (appeared / continued / cancelled)
    if (LEGACY_ACTIONS.includes(action as HearingOutcomeAction) && !APPEARANCE_ACTIONS.includes(action as AppearanceOutcomeAction)) {
      await logHearingOutcome(token, item, {
        action: action as HearingOutcomeAction,
        nextHearingDate: nextDate || undefined,
        note: whatHappened || undefined
      });

      let extra = "";
      if (action === "appeared") {
        const notice = await sendClientEventClosedNotice(token, item, "appeared");
        if (notice) extra = ` ${notice}`;
      }

      invalidateTasksDataCache(token);
      await appendTaskActivity(token, {
        user: session?.user?.email || session?.user?.name || "staff",
        action: "hearing.outcome",
        source: "Event",
        itemId: item.id,
        clientCase: body.clientCase || item.clientCase,
        summary: `Hearing outcome logged — ${action}`,
        details: whatHappened
      });

      return NextResponse.json({
        ok: true,
        message: `Hearing outcome saved (${action}).${extra}`
      });
    }

    if (!APPEARANCE_ACTIONS.includes(action as AppearanceOutcomeAction)) {
      return NextResponse.json(
        { error: "action must be completed, rescheduled, postponed, or cancelled." },
        { status: 400 }
      );
    }

    if (!whatHappened) {
      return NextResponse.json({ error: "whatHappened is required." }, { status: 400 });
    }
    if (action === "rescheduled" && !nextDate) {
      return NextResponse.json({ error: "nextDate is required when action is rescheduled." }, { status: 400 });
    }

    const result = await logAppearanceOutcome(token, item, {
      action: action as AppearanceOutcomeAction,
      whatHappened,
      nextDate: nextDate || undefined,
      createNextDateFollowUp: body.createNextDateFollowUp,
      courtFollowUpKind: body.courtFollowUpKind as AppearanceCourtFollowUpKind | undefined,
      followUpDate: body.followUpDate,
      followUpNote: body.followUpNote
    });

    let extra = "";
    if (action === "completed") {
      const notice = await sendClientEventClosedNotice(token, item, "appeared");
      if (notice) extra = ` ${notice}`;
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "event.outcome",
      source: "Event",
      itemId: item.id,
      clientCase: body.clientCase || item.clientCase,
      summary: `${item.category || "Event"} outcome — ${action}`,
      details: whatHappened
    });

    const followUpNote = result.followUpTaskId
      ? ` Follow-up task ${result.followUpTaskId} created.`
      : result.followUpEventId
        ? ` Follow-up event ${result.followUpEventId} created.`
        : "";
    return NextResponse.json({
      ok: true,
      message: `${result.message}${followUpNote}${extra}`,
      followUpTaskId: result.followUpTaskId,
      followUpEventId: result.followUpEventId,
      action: result.action
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status: status === 401 ? 401 : 400 });
  }
}
