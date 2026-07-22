import { NextResponse } from "next/server";
import { requireAdminBillingAccessToken, requireBillingAccessToken, sessionAuditEmail } from "@/lib/api-auth";
import { sanitizeSheetName, type UpdateClientPayload } from "@/lib/gl-config";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { deleteClientPermanently } from "@/lib/sheets/client-delete";
import { buildClientDeletePreview, getOpenOfficeItemsForClient } from "@/lib/sheets/client-delete-preview";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getClientDetail, updateClient } from "@/lib/sheets/master";
import { deleteOfficeItemsPermanently } from "@/lib/office-tasks/sheets/delete-items";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const client = await getClientDetail(accessToken, clientCode);

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load client.";
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const body = (await request.json()) as UpdateClientPayload;
    const result = await updateClient(accessToken, clientCode, body);

    await appendAuditLog(accessToken, {
      user: await sessionAuditEmail(),
      action: "client.update",
      clientCode,
      summary: "Client profile updated",
      details: body.clientName || body.caseTitle || ""
    });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "master-rows");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, `profile:${clientCode}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update client.";
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { token: accessToken, email } = await requireAdminBillingAccessToken();

    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const body = await request.json().catch(() => ({}));
    const confirmCode = String((body as { confirmCode?: string }).confirmCode || "").trim();
    const force = (body as { force?: boolean }).force === true;
    const deleteOpenOfficeItems =
      (body as { deleteOpenOfficeItems?: boolean }).deleteOpenOfficeItems === true;

    if (confirmCode !== clientCode) {
      return NextResponse.json(
        { error: "Confirmation failed. Type the exact client code to delete." },
        { status: 400 }
      );
    }

    const client = await getClientDetail(accessToken, clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    let officeItemsRemoved = 0;
    if (deleteOpenOfficeItems) {
      const taskItems = await collectAllItems(accessToken).catch(() => []);
      const openItems = getOpenOfficeItemsForClient(client, taskItems);
      officeItemsRemoved = await deleteOfficeItemsPermanently(accessToken, openItems);
    }

    await appendAuditLog(accessToken, {
      user: email || "unknown",
      action: "client.delete",
      clientCode,
      summary: "Permanent delete requested",
      details: deleteOpenOfficeItems
        ? `Also removed ${officeItemsRemoved} open task(s)/hearing(s) from Office Tasks`
        : ""
    });

    const result = await deleteClientPermanently(accessToken, clientCode, { force });

    invalidateCache(accessToken, "clients");
    invalidateCache(accessToken, "home-dashboard");
    invalidateCache(accessToken, `profile:${clientCode}`);
    invalidateCache(accessToken, "sheet-titles");

    const message =
      officeItemsRemoved > 0
        ? `${result.message} Removed ${officeItemsRemoved} open task(s)/hearing(s) from Office Tasks.`
        : result.message;

    return NextResponse.json({ ...result, message, officeItemsRemoved });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete client.";
    const status =
      message.includes("owners/admins") || message.startsWith("Unauthorized")
        ? 403
        : message.includes("Confirmation")
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
