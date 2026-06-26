import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminEmail } from "@/lib/admin";
import { parseMoney } from "@/lib/gl-config";
import { isQuotaError, quotaErrorMessage, invalidateBillingReadCaches, invalidateCache } from "@/lib/sheets/cache";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { addLedgerEntry } from "@/lib/sheets/ledger";
import type { FieldDispatchEditPayload } from "@/lib/gl-config";
import {
  markFieldDispatchBilled,
  reconcileFieldDispatch,
  setFieldDispatchStaffSalaryPaid,
  updateFieldDispatch,
  updateFieldDispatchStatus
} from "@/lib/sheets/field-dispatch";

const CACHE_KEY = "field-dispatch";

function errorResponse(error: unknown, fallback: string) {
  if (isQuotaError(error)) {
    return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message.includes("firm admins") || message.includes("ADMIN_EMAILS")
      ? 403
      : message.startsWith("Unauthorized") || message.includes("do not have access")
        ? 403
        : 400;
  return NextResponse.json({ error: message }, { status });
}

type PatchBody = FieldDispatchEditPayload & {
  action?: "reconcile" | "bill" | "markPaid" | "markStaffSalaryPaid" | "unmarkStaffSalaryPaid" | "edit";
  actualExpenses?: number | string;
  returnedToOffice?: number | string;
  notes?: string;
  billedDate?: string;
  staffSalaryPaid?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    requireAdminEmail(session?.user?.email);

    const { id } = await context.params;
    const dispatchId = decodeURIComponent(id || "").trim();
    if (!dispatchId) {
      return NextResponse.json({ error: "Dispatch ID is required." }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;
    const action = body.action || "reconcile";

    if (action === "edit") {
      const entry = await updateFieldDispatch(accessToken, {
        dispatchId,
        date: body.date,
        days: body.days,
        location: body.location || "",
        staff: body.staff,
        clientCode: body.clientCode,
        purpose: body.purpose || "",
        advanceGiven: body.advanceGiven,
        returnedToOffice: body.returnedToOffice,
        serviceFee: body.serviceFee,
        notes: body.notes
      });
      invalidateCache(accessToken, CACHE_KEY);
      return NextResponse.json({
        ok: true,
        message: `${entry.dispatchId} updated.`,
        dispatch: entry
      });
    }

    if (action === "reconcile") {
      const entry = await reconcileFieldDispatch(accessToken, {
        dispatchId,
        actualExpenses: 0,
        returnedToOffice: body.returnedToOffice ?? 0,
        notes: body.notes
      });
      let dispatch = entry;
      if (body.staffSalaryPaid) {
        dispatch = await setFieldDispatchStaffSalaryPaid(accessToken, dispatchId, true);
      }
      invalidateCache(accessToken, CACHE_KEY);
      invalidateCache(accessToken, "staff-salary");
      return NextResponse.json({
        ok: true,
        message: `${dispatch.dispatchId} reconciled${dispatch.staffSalaryPaid ? " · service fee marked paid to staff" : ""}.`,
        dispatch
      });
    }

    if (action === "markPaid") {
      const entry = await updateFieldDispatchStatus(accessToken, dispatchId, "Paid");
      invalidateCache(accessToken, CACHE_KEY);
      return NextResponse.json({
        ok: true,
        message: `${entry.dispatchId} marked paid.`,
        dispatch: entry
      });
    }

    if (action === "markStaffSalaryPaid" || action === "unmarkStaffSalaryPaid") {
      const entry = await setFieldDispatchStaffSalaryPaid(
        accessToken,
        dispatchId,
        action === "markStaffSalaryPaid"
      );
      invalidateCache(accessToken, CACHE_KEY);
      invalidateCache(accessToken, "staff-salary");
      return NextResponse.json({
        ok: true,
        message: entry.staffSalaryPaid
          ? `${entry.dispatchId} service fee marked paid to staff.`
          : `${entry.dispatchId} staff salary payment cleared.`,
        dispatch: entry
      });
    }

    if (action === "bill") {
      const reconciled = await reconcileFieldDispatch(accessToken, {
        dispatchId,
        actualExpenses: 0,
        returnedToOffice: body.returnedToOffice ?? 0,
        notes: body.notes
      });

      if (!reconciled.clientCode) {
        return NextResponse.json({ error: "Add a client code before billing." }, { status: 400 });
      }

      const billedDate = body.billedDate?.trim() || reconciled.date;
      const expenseAmount = parseMoney(reconciled.actualExpenses);
      const feeAmount = parseMoney(reconciled.serviceFee);
      const label = `${reconciled.location} · ${reconciled.purpose} (${reconciled.dispatchId})`;

      if (expenseAmount > 0) {
        await addLedgerEntry(accessToken, {
          clientCode: reconciled.clientCode,
          type: "Charge",
          date: billedDate,
          category: "Reimbursement",
          description: `Field expenses — ${label}`,
          charge: expenseAmount
        });
      }

      if (feeAmount > 0) {
        await addLedgerEntry(accessToken, {
          clientCode: reconciled.clientCode,
          type: "Charge",
          date: billedDate,
          category: "Appearance Fee",
          description: `Liaison / field service fee — ${label}`,
          charge: feeAmount
        });
      }

      const entry = await markFieldDispatchBilled(accessToken, dispatchId, billedDate);
      invalidateCache(accessToken, CACHE_KEY);
      invalidateBillingReadCaches(accessToken);
      invalidateCache(accessToken, `profile:${reconciled.clientCode}`);

      await appendAuditLog(accessToken, {
        user: session?.user?.email || "unknown",
        action: "field-dispatch.bill",
        clientCode: entry.clientCode,
        summary: `${entry.dispatchId} billed to ${entry.clientCode}`,
        details: `Expenses ${expenseAmount} + fee ${feeAmount}`
      }).catch(() => undefined);

      return NextResponse.json({
        ok: true,
        message: `${entry.dispatchId} billed to ${entry.clientCode} (${entry.billableTotal}).`,
        dispatch: entry
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error, "Failed to update field dispatch.");
  }
}
