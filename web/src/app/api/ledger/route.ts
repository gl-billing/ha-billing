import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { LedgerEditPayload, LedgerEntryPayload } from "@/lib/gl-config";
import { requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateBillingReadCaches, invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import {
  triggerTaskOnArSent,
  triggerTaskOnCharge,
  triggerTaskOnPayment,
  triggerTaskOnSoaSent
} from "@/lib/billing-task-triggers";
import { addLedgerEntry, editLedgerEntry, restoreLedgerEntry, voidLedgerEntry } from "@/lib/sheets/ledger";
import { closeSoaFollowUpTasks } from "@/lib/soa-follow-up";

async function auditUser(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || "unknown";
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as LedgerEntryPayload;
    const result = await addLedgerEntry(accessToken, body);
    let soaFollowUpsClosed = 0;

    try {
      if (body.type?.toLowerCase() === "charge") {
        await triggerTaskOnCharge(accessToken, body);
      } else if (body.type?.toLowerCase() === "payment") {
        await triggerTaskOnPayment(accessToken, body);
        soaFollowUpsClosed = await closeSoaFollowUpTasks(accessToken, body.clientCode).catch(() => 0);
      }
    } catch {
      /* billing saved; task trigger is best-effort */
    }

    try {
      await appendAuditLog(accessToken, {
        user: await auditUser(),
        action: "ledger.add",
        clientCode: body.clientCode,
        summary: `${body.type} added`,
        details: `${body.description || body.category || ""} · ${body.charge || body.payment || ""}`
      });
    } catch {
      const suffix =
        soaFollowUpsClosed > 0
          ? ` Closed ${soaFollowUpsClosed} collection follow-up task${soaFollowUpsClosed === 1 ? "" : "s"}.`
          : "";
      return NextResponse.json({
        ...result,
        message: `${result.message} (Saved; audit log could not be updated — redeploy or add an Audit Log sheet tab.)${suffix}`,
        soaFollowUpsClosed
      });
    }

    invalidateBillingReadCaches(accessToken);
    invalidateCache(accessToken, `profile:${body.clientCode}`);
    const suffix =
      soaFollowUpsClosed > 0
        ? ` Closed ${soaFollowUpsClosed} collection follow-up task${soaFollowUpsClosed === 1 ? "" : "s"}.`
        : "";
    return NextResponse.json({
      ...result,
      message: `${result.message || "Entry saved."}${suffix}`,
      soaFollowUpsClosed
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to save entry.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as LedgerEditPayload;

    if (body.reclassifyIncome) {
      requireAdminEmail(session?.user?.email);
    }

    const result = await editLedgerEntry(accessToken, body);

    try {
      await appendAuditLog(accessToken, {
        user: await auditUser(),
        action: "ledger.edit",
        clientCode: body.clientCode,
        summary: `Row ${body.sheetRow} edited`,
        details: body.description || ""
      });
    } catch {
      return NextResponse.json({
        ...result,
        message: `${result.message} (Saved; audit log could not be updated.)`
      });
    }

    invalidateBillingReadCaches(accessToken);
    invalidateCache(accessToken, `profile:${body.clientCode}`);
    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to edit entry.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = await request.json();
    const clientCode = String(body.clientCode || "");
    const sheetRow = Number(body.sheetRow);

    if (!clientCode || !sheetRow) {
      return NextResponse.json({ error: "Client code and sheet row are required." }, { status: 400 });
    }

    const result = await voidLedgerEntry(accessToken, clientCode, sheetRow);

    try {
      await appendAuditLog(accessToken, {
        user: await auditUser(),
        action: "ledger.void",
        clientCode,
        summary: `Row ${sheetRow} voided`,
        details: ""
      });
    } catch {
      return NextResponse.json({
        ...result,
        message: `${result.message} (Saved; audit log could not be updated.)`
      });
    }

    invalidateBillingReadCaches(accessToken);
    invalidateCache(accessToken, `profile:${clientCode}`);
    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to void entry.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const body = await request.json();
    const clientCode = String(body.clientCode || "");
    const sheetRow = Number(body.sheetRow);
    const snapshot = body.snapshot;

    if (!clientCode || !sheetRow || !snapshot) {
      return NextResponse.json({ error: "Client code, sheet row, and snapshot are required." }, { status: 400 });
    }

    const result = await restoreLedgerEntry(accessToken, clientCode, sheetRow, snapshot);

    try {
      await appendAuditLog(accessToken, {
        user: await auditUser(),
        action: "ledger.restore",
        clientCode,
        summary: `Row ${sheetRow} restored after void`,
        details: ""
      });
    } catch {
      return NextResponse.json({
        ...result,
        message: `${result.message} (Restored; audit log could not be updated.)`
      });
    }

    invalidateBillingReadCaches(accessToken);
    invalidateCache(accessToken, `profile:${clientCode}`);
    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to restore entry.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
