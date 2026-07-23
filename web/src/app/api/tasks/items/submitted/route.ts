import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { closeLinkedPrepTasksForEvent } from "@/lib/office-tasks/prep-completion";
import { sendClientEventClosedNotice } from "@/lib/office-tasks/client-event-notices";
import { handleFilingSubmittedFollowUp } from "@/lib/office-tasks/filing-submitted-follow-up";
import { enqueueFilingAfterSubmitted } from "@/lib/office-tasks/filing-queue-enqueue";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { setEventSubmitted } from "@/lib/office-tasks/sheets/complete";
import { resolveOfficeItemForMutation } from "@/lib/office-tasks/sheets/resolve-item-row";
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
      /** Skip enqueue (preview only). */
      skipFilingQueue?: boolean;
      /** Confirm / override queue for admin-other filings. */
      filingQueue?: FilingQueueKind;
      /** When true, only return routing decision without marking submitted. */
      previewFilingRoute?: boolean;
    };

    const itemId = body.itemId ? String(body.itemId).trim() : "";
    const rowNumber = Number(body.rowNumber);
    const submitted = body.submitted !== false;

    if (body.source !== "Event") {
      return NextResponse.json({ error: "Event source is required." }, { status: 400 });
    }
    if (!itemId && (!rowNumber || rowNumber < 2)) {
      return NextResponse.json({ error: "itemId or rowNumber is required." }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(token, "Event", { itemId, rowNumber });
    if (!target) {
      return NextResponse.json({ error: "Could not find this event in the spreadsheet." }, { status: 404 });
    }

    const item = target.item;
    if (!item || item.source !== "Event") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (body.previewFilingRoute) {
      const { resolveFilingQueueRoute } = await import("@/lib/office-tasks/filing-queue-route");
      const { resolveClientCode } = await import("@/lib/office-tasks/client-matter");
      const { getClientDetail } = await import("@/lib/sheets/master");
      const code = resolveClientCode(item);
      const client = code ? await getClientDetail(token, code).catch(() => null) : null;
      const decision = resolveFilingQueueRoute({
        caseType: client?.caseType,
        pleadingType: item.pleadingType,
        pleadingCaseNature: item.pleadingCaseNature
      });
      return NextResponse.json({ ok: true, ...decision, clientCode: code });
    }

    await setEventSubmitted(token, target.rowNumber, submitted);

    let extraMessage = "";
    let filingQueue: { queue: FilingQueueKind; requiresConfirm: boolean; reason: string; created: boolean } | null =
      null;
    if (submitted && item.source === "Event") {
      const closed = await closeLinkedPrepTasksForEvent(token, item.id, target.rowNumber);
      const filing = await handleFilingSubmittedFollowUp(token, item);
      const parts: string[] = [];
      if (closed > 0) parts.push(`Closed ${closed} linked prep task${closed === 1 ? "" : "s"}`);
      if (filing.followUpsClosed > 0) {
        parts.push(`Closed ${filing.followUpsClosed} filing follow-up task${filing.followUpsClosed === 1 ? "" : "s"}`);
      }
      if (filing.proofPending) parts.push("Proof of filing pending on event");
      if (parts.length) extraMessage = ` ${parts.join("; ")}.`;
      const notice = await sendClientEventClosedNotice(token, item, "filed");
      if (notice) extraMessage += ` ${notice}`;

      if (!body.skipFilingQueue) {
        filingQueue = await enqueueFilingAfterSubmitted(token, item, {
          queueOverride: body.filingQueue
        });
        if (filingQueue.created) {
          extraMessage += ` Added to ${filingQueue.queue === "e-filing" ? "E-filing" : "physical filing"} queue.`;
        }
      }
    }

    invalidateTasksDataCache(token);

    await appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: submitted ? "done" : "reopen",
      source: "Event",
      itemId: itemId || item?.id || "",
      clientCase: body.clientCase ? String(body.clientCase) : item?.clientCase || "",
      summary: submitted ? "Filing marked submitted" : "Filing submission cleared"
    });

    return NextResponse.json({
      ok: true,
      message: `${submitted ? "Marked as filed / submitted." : "Submission status cleared."}${extraMessage}`,
      filingQueue
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
