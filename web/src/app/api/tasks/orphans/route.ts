import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { findOrphanTaskItems } from "@/lib/office-tasks/orphan-tasks";
import { deleteOfficeItemsPermanently } from "@/lib/office-tasks/sheets/delete-items";
import { getCachedAllItems, invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Admin only." }, { status: 403 });
    }

    const token = await requireSessionAccessToken();
    const items = await getCachedAllItems(token);
    const orphans = await findOrphanTaskItems(token, items);
    return NextResponse.json({ orphans, count: orphans.length });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not scan orphan tasks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Admin only." }, { status: 403 });
    }

    const token = await requireSessionAccessToken();
    const body = (await request.json()) as {
      items?: Array<{ source: "Task" | "Event"; rowNumber: number }>;
    };

    const toDelete = (body.items || []).filter(
      (item) => (item.source === "Task" || item.source === "Event") && item.rowNumber >= 2
    );

    if (!toDelete.length) {
      return NextResponse.json({ error: "Select at least one item to delete." }, { status: 400 });
    }

    const deleted = await deleteOfficeItemsPermanently(token, toDelete);
    invalidateTasksDataCache(token);

    return NextResponse.json({
      ok: true,
      message: `Permanently deleted ${deleted} orphan item(s).`,
      deleted
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
