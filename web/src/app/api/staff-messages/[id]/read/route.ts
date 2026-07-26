import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { markStaffMessageRead } from "@/lib/office-tasks/staff-messages";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const token = await requireSessionAccessToken();
    const message = await markStaffMessageRead(token, decodeURIComponent(id), email);
    if (!message) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: {
        id: message.id,
        readAt: message.readAt
      }
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not mark message read.";
    const status = message.includes("Unauthorized") || message.includes("sign in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
