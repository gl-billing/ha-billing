import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { NewClientPayload } from "@/lib/gl-config";
import { formatClientCaseLabel } from "@/lib/gl-config";
import { matterTypeCaseLabel, resolveClientMatterType } from "@/lib/client-matter-type";
import { normalizeIntakeChecklistInput, type IntakeChecklistInput } from "@/lib/intake-checklist-config";
import { assertIntakeConflictClear } from "@/lib/intake-conflict-gate";
import { createIntakeSeedTasks } from "@/lib/intake-seed-tasks";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { createClient } from "@/lib/sheets/clients-create";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import type { TaskFormInput } from "@/lib/office-tasks/sheets/tasks";

type IntakeBody = NewClientPayload & {
  acknowledgeConflicts?: boolean;
  conflictReviewChoice?: "same_case" | "different_case";
  assignedAttorney?: string;
  initialTasks?: Array<{
    description: string;
    assignedTo: string;
    dueDate: string;
    taskType?: string;
  }>;
  checklist?: IntakeChecklistInput;
};

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as IntakeBody;

    await assertIntakeConflictClear(accessToken, {
      clientCode: body.clientCode,
      clientName: body.clientName,
      caseTitle: body.caseTitle,
      caseNumber: body.caseNumber,
      courtPending: body.courtPending,
      conflictReviewChoice: body.conflictReviewChoice,
      acknowledgeConflicts: body.acknowledgeConflicts
    });

    const result = await createClient(accessToken, body);
    const clientCode = result.clientCode;
    const matterType = resolveClientMatterType({
      matterType: body.matterType,
      caseTitle: body.caseTitle
    });
    const clientCase = formatClientCaseLabel(
      body.clientName.trim(),
      matterTypeCaseLabel(matterType, body.caseTitle)
    );
    const assignee = body.assignedAttorney?.trim() || "Unassigned";

    const extraTasks: TaskFormInput[] = (body.initialTasks || []).map((task) => ({
      clientCase,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      description: task.description,
      taskType: task.taskType || "Task",
      priority: "Medium",
      status: "In Progress",
      reminderDays: 2
    }));

    const normalizedChecklist = normalizeIntakeChecklistInput(body.checklist);

    const createdTasks = await createIntakeSeedTasks(accessToken, {
      clientCase,
      assignee,
      courtPending: body.courtPending,
      checklist: normalizedChecklist,
      extraTasks
    });

    const conflictNote =
      body.conflictReviewChoice === "different_case"
        ? "Conflict review: different case — new client tab and ledger."
        : body.acknowledgeConflicts
          ? "Conflict review: acknowledged."
          : "";

    await appendAuditLog(accessToken, {
      user: session?.user?.email || "unknown",
      action: "intake.complete",
      clientCode,
      summary: "New matter intake completed",
      details: [conflictNote, createdTasks.length ? `Created: ${createdTasks.join(", ")}` : ""]
        .filter(Boolean)
        .join(" ")
    });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, `profile:${clientCode}`);

    return NextResponse.json({
      ok: true,
      clientCode,
      message: `Matter ${clientCode} registered.${createdTasks.length ? ` ${createdTasks.length} task(s)/event(s) created.` : ""}`,
      createdTasks
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Intake failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
