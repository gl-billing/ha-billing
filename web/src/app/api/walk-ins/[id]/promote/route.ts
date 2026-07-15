import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { normalizeIntakeChecklistInput, type IntakeChecklistInput } from "@/lib/intake-checklist-config";
import { assertIntakeConflictClear } from "@/lib/intake-conflict-gate";
import { createIntakeSeedTasks } from "@/lib/intake-seed-tasks";
import type { ConflictReviewChoice } from "@/lib/sheets/client-code-check";
import type { NewClientPayload } from "@/lib/gl-config";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateBillingReadCaches, invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import {
  closeWalkInClient,
  listWalkInClients,
  promoteWalkInClient,
  transferWalkInBillingToLedger,
  walkInHasTransferableBilling
} from "@/lib/sheets/walk-ins";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

type RouteContext = { params: Promise<{ id: string }> };

type PromoteBody = NewClientPayload & {
  action?: string;
  assignedAttorney?: string;
  checklist?: IntakeChecklistInput;
  transferBilling?: boolean;
  conflictReviewChoice?: ConflictReviewChoice;
  acknowledgeConflicts?: boolean;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { id } = await context.params;
    const body = (await request.json()) as PromoteBody;

    if (body.action === "close") {
      await closeWalkInClient(accessToken, id);
      invalidateCache(accessToken, "walk-ins");
      return NextResponse.json({ ok: true, message: `Walk-in ${id} closed.` });
    }

    const walkIns = await listWalkInClients(accessToken);
    const walkInEntry = walkIns.find((w) => w.walkInId.toUpperCase() === id.trim().toUpperCase());
    if (!walkInEntry) {
      return NextResponse.json({ error: `Walk-in not found: ${id}` }, { status: 404 });
    }

    await assertIntakeConflictClear(accessToken, {
      clientCode: body.clientCode,
      clientName: body.clientName,
      caseTitle: body.caseTitle,
      caseNumber: body.caseNumber,
      courtPending: body.courtPending,
      conflictReviewChoice: body.conflictReviewChoice,
      acknowledgeConflicts: body.acknowledgeConflicts
    });

    const result = await promoteWalkInClient(accessToken, id, body);
    const assignee = body.assignedAttorney?.trim() || "Unassigned";
    const checklist = body.checklist;
    const normalizedChecklist = normalizeIntakeChecklistInput(checklist);
    const shouldSeedTasks = Boolean(
      normalizedChecklist?.engagementLetter ||
        normalizedChecklist?.scheduleInitialConference
    );

    let createdTasks: string[] = [];
    if (shouldSeedTasks) {
      createdTasks = await createIntakeSeedTasks(accessToken, {
        clientCase: result.clientCase,
        assignee,
        checklist: normalizedChecklist
      });
      invalidateTasksDataCache(accessToken);
    }

    let billingNote: string | null = null;
    const transferBilling =
      body.transferBilling !== false && walkInHasTransferableBilling(walkInEntry);
    if (transferBilling) {
      billingNote = await transferWalkInBillingToLedger(accessToken, walkInEntry, result.clientCode);
      invalidateBillingReadCaches(accessToken);
      invalidateCache(accessToken, `profile:${result.clientCode}`);
    }

    invalidateCache(accessToken, "walk-ins");
    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "clients:active");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, "sheet-titles");
    invalidateCache(accessToken, `profile:${result.clientCode}`);

    const session = await getServerSession(authOptions);
    await appendAuditLog(accessToken, {
      user: session?.user?.email || "system",
      action: "Promote walk-in",
      clientCode: result.clientCode,
      summary: `Promoted walk-in ${id} to client file ${result.clientCode}`,
      details: [
        result.clientCase,
        createdTasks.length ? `Tasks: ${createdTasks.join(", ")}` : "",
        billingNote || ""
      ]
        .filter(Boolean)
        .join(" · ")
    });

    const messageParts = [`Walk-in promoted to client file ${result.clientCode}.`];
    if (createdTasks.length) {
      messageParts.push(`${createdTasks.length} starter task(s) created in Office Tasks.`);
    }
    if (billingNote) messageParts.push(billingNote);

    return NextResponse.json({
      ok: true,
      clientCode: result.clientCode,
      clientCase: result.clientCase,
      createdTasks,
      billingTransferred: Boolean(billingNote),
      message: messageParts.join(" ")
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to promote walk-in client.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { id } = await context.params;
    const walkIns = await listWalkInClients(accessToken);
    const entry = walkIns.find((w) => w.walkInId.toUpperCase() === id.trim().toUpperCase());
    if (!entry) {
      return NextResponse.json({ error: "Walk-in not found." }, { status: 404 });
    }
    return NextResponse.json({ walkIn: entry });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Unable to load walk-in client.";
    const status =
      message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
