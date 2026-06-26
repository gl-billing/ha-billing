import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { invalidateCache, isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { updateWalkInContact } from "@/lib/sheets/walk-ins";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const { id } = await context.params;
    const walkInId = decodeURIComponent(id).trim();
    if (!walkInId) {
      return NextResponse.json({ error: "Walk-in ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const walkIn = await updateWalkInContact(accessToken, walkInId, {
      email: body.email !== undefined ? String(body.email) : undefined,
      phone: body.phone !== undefined ? String(body.phone) : undefined
    });

    invalidateCache(accessToken, "walk-ins");
    invalidateCache(accessToken, "clients:active");

    return NextResponse.json({
      ok: true,
      walkIn,
      message: "Walk-in contact updated."
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to update walk-in contact.";
    const status = message.includes("do not have access")
      ? 403
      : message.startsWith("Unauthorized")
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
