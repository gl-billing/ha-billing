import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { setupFilingWorkflowForEvent } from "@/lib/office-tasks/filing-workflow-setup";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";

export async function POST(request: Request) {
  try {
    const token = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as {
      eventId?: string;
      pleadingType?: string;
      filingMode?: string;
      draftDocUrl?: string;
      draftDocNote?: string;
      drafter?: string;
      reviewer?: string;
      filingStaff?: string;
      serviceStaff?: string;
      taskDueDates?: {
        drafting?: string;
        review?: string;
        exhibits?: string;
        filing?: string;
        serving?: string;
        proof?: string;
      };
      recommendedQueue?: FilingQueueKind;
      confirmedQueue?: FilingQueueKind;
      overrideReason?: string;
      generateTasks?: Record<string, boolean>;
    };

    const eventId = String(body.eventId || "").trim();
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }

    const dates = body.taskDueDates || {};
    const result = await setupFilingWorkflowForEvent(token, {
      eventId,
      pleadingType: body.pleadingType,
      filingMode: body.filingMode,
      draftDocUrl: body.draftDocUrl,
      draftDocNote: body.draftDocNote,
      drafter: String(body.drafter || "").trim(),
      reviewer: String(body.reviewer || "").trim(),
      filingStaff: String(body.filingStaff || "").trim(),
      serviceStaff: String(body.serviceStaff || "").trim(),
      taskDueDates: {
        drafting: String(dates.drafting || ""),
        review: String(dates.review || ""),
        exhibits: String(dates.exhibits || ""),
        filing: String(dates.filing || ""),
        serving: String(dates.serving || ""),
        proof: String(dates.proof || "")
      },
      recommendedQueue: body.recommendedQueue === "physical" ? "physical" : "e-filing",
      confirmedQueue: body.confirmedQueue === "physical" ? "physical" : "e-filing",
      overrideReason: body.overrideReason,
      generateTasks: body.generateTasks
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    invalidateTasksDataCache(token);
    void appendTaskActivity(token, {
      user: session?.user?.email || session?.user?.name || "staff",
      action: "create",
      source: "Event",
      itemId: result.eventId,
      clientCase: "",
      summary: `Filing workflow set up (deadline ${result.originalDeadline} preserved)`
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      message: result.message,
      eventId: result.eventId,
      originalDeadline: result.originalDeadline,
      workflowStage: result.workflowStage,
      taskIds: result.taskIds,
      queueCreated: result.queueCreated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Filing workflow setup failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
