import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessTasks } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import { enqueueFilingAfterSubmitted } from "@/lib/office-tasks/filing-queue-enqueue";
import type {
  FilingCopyFurnishedParty,
  FilingQueueUpdateInput
} from "@/lib/office-tasks/filing-queue-types";
import {
  listFilingQueueRows,
  updateFilingQueueRow
} from "@/lib/office-tasks/sheets/filing-queue";
import { getActiveEmployeeNames } from "@/lib/office-tasks/sheets/employees";
import { resolveOfficeItemForMutation } from "@/lib/office-tasks/sheets/resolve-item-row";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !canAccessTasks(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accessToken = await requireSessionAccessToken();
    const url = new URL(request.url);
    const queueParam = url.searchParams.get("queue");
    const queue: FilingQueueKind | undefined =
      queueParam === "physical" || queueParam === "e-filing" ? queueParam : undefined;

    const [rows, staff] = await Promise.all([
      listFilingQueueRows(accessToken, { queue }),
      getActiveEmployeeNames(accessToken).catch(() => [] as string[])
    ]);

    return NextResponse.json({ rows, staff });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load filing queue.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !canAccessTasks(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as {
      action?: "enqueue";
      source?: string;
      itemId?: string;
      rowNumber?: number;
      filingQueue?: FilingQueueKind;
    };

    if (body.action !== "enqueue") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const target = await resolveOfficeItemForMutation(accessToken, "Event", {
      itemId: body.itemId,
      rowNumber: Number(body.rowNumber) || undefined
    });
    if (!target?.item || target.item.source !== "Event") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const result = await enqueueFilingAfterSubmitted(accessToken, target.item, {
      queueOverride: body.filingQueue || "e-filing"
    });
    invalidateTasksDataCache(accessToken);
    return NextResponse.json({
      ok: true,
      ...result,
      message: result.created
        ? `Added to ${result.queue === "e-filing" ? "E-filing" : "physical"} queue.`
        : "Already in queue or not created."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue filing.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !canAccessTasks(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accessToken = await requireSessionAccessToken();
    const body = (await request.json()) as {
      sheetRow?: number;
      patch?: FilingQueueUpdateInput & { copyFurnished?: FilingCopyFurnishedParty[] };
    };
    const sheetRow = Number(body.sheetRow);
    if (!sheetRow || sheetRow < 2) {
      return NextResponse.json({ error: "sheetRow is required." }, { status: 400 });
    }
    const row = await updateFilingQueueRow(accessToken, sheetRow, body.patch || {});
    invalidateTasksDataCache(accessToken);
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update filing queue.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
