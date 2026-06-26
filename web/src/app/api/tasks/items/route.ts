import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { getCachedAllItems } from "@/lib/office-tasks/tasks-cache";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

/** Lightweight task/event list for client matter panel outside the tasks app. */
export async function GET() {
  try {
    const token = await requireSessionAccessToken();
    const [items, employeeDirectory] = await Promise.all([
      getCachedAllItems(token),
      getEmployeeDirectory(token)
    ]);
    const employees = employeeDirectory.map((entry) => entry.name);
    return NextResponse.json({ items, employees, employeeDirectory });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to load items.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
