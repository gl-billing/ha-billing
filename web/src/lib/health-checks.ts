import { GL, formatPeso } from "@/lib/gl-config";
import { getSheetTitles } from "@/lib/sheets/sheet-meta";
import { findMasterRow, getAllMasterRows } from "@/lib/sheets/master";
import { sheetExists } from "@/lib/sheets/client";
import { backfillMissingSourceIds, isValidEventSourceId, isValidTaskSourceId } from "@/lib/office-tasks/sheets/repair-source-ids";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { assertTasksWorkbookSheets } from "@/lib/office-tasks/sheets/client";
import { isHearingPendingCourtConfirmation } from "@/lib/hearing-escalation";
import { findOrphanTaskItems } from "@/lib/office-tasks/orphan-tasks";

export type HealthCheckStatus = "ok" | "warn" | "error";

export type HealthCheck = {
  id: string;
  label: string;
  status: HealthCheckStatus;
  count: number;
  message: string;
  fixable?: boolean;
};

const PROTECTED_TABS = new Set(
  [
    GL.sheets.settings,
    GL.sheets.master,
    GL.sheets.dashboard,
    GL.sheets.documentLog,
    GL.sheets.auditLog,
    "Template",
    "Invoice",
    "Acknowledgment Receipt",
    "About",
    "Pending AR",
    "System Check"
  ].map((s) => s.toLowerCase())
);

export async function runBillingHealthChecks(accessToken: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const masterRows = await getAllMasterRows(accessToken);
  const titles = await getSheetTitles(accessToken);
  const masterCodes = new Set<string>();

  let missingLedger = 0;
  let duplicateCodes = 0;
  const codeCounts = new Map<string, number>();

  for (const row of masterRows) {
    const code = String(row[0] || "").trim();
    if (!code) continue;
    masterCodes.add(code);
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    if (!(await sheetExists(accessToken, code))) missingLedger++;
  }

  for (const [, count] of codeCounts) {
    if (count > 1) duplicateCodes++;
  }

  let orphanTabs = 0;
  for (const title of titles) {
    if (PROTECTED_TABS.has(title.toLowerCase())) continue;
    if (!masterCodes.has(title)) orphanTabs++;
  }

  checks.push({
    id: "master-without-ledger",
    label: "Master List rows missing ledger tab",
    status: missingLedger ? "error" : "ok",
    count: missingLedger,
    message: missingLedger
      ? `${missingLedger} client(s) on Master List have no matching ledger tab.`
      : "Every Master List client has a ledger tab.",
    fixable: missingLedger > 0
  });

  checks.push({
    id: "orphan-ledger-tabs",
    label: "Ledger tabs without Master List row",
    status: orphanTabs ? "warn" : "ok",
    count: orphanTabs,
    message: orphanTabs
      ? `${orphanTabs} sheet tab(s) look like client ledgers but are not on Master List.`
      : "No orphan client ledger tabs found."
  });

  checks.push({
    id: "duplicate-client-codes",
    label: "Duplicate client codes on Master List",
    status: duplicateCodes ? "error" : "ok",
    count: duplicateCodes,
    message: duplicateCodes
      ? `${duplicateCodes} duplicate code(s) detected on Master List.`
      : "No duplicate client codes."
  });

  return checks;
}

export async function runTasksHealthChecks(accessToken: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    await assertTasksWorkbookSheets(accessToken);
    checks.push({
      id: "tasks-workbook",
      label: "Tasks workbook sheets",
      status: "ok",
      count: 0,
      message: "Master Tasks, Hearings & Events, and Employees tabs are present."
    });
  } catch (error) {
    checks.push({
      id: "tasks-workbook",
      label: "Tasks workbook sheets",
      status: "error",
      count: 1,
      message: error instanceof Error ? error.message : "Tasks workbook check failed."
    });
    return checks;
  }

  const items = await collectAllItems(accessToken);
  let invalidIds = 0;
  let calendarMissingId = 0;
  let unconfirmedHearings = 0;

  for (const item of items) {
    if (item.source === "Task" && item.id && !isValidTaskSourceId(item.id)) invalidIds++;
    if (item.source === "Event" && item.id && !isValidEventSourceId(item.id)) invalidIds++;
    if (item.calendarSync && !item.calendarEventId) calendarMissingId++;
    if (isHearingPendingCourtConfirmation(item)) unconfirmedHearings++;
  }

  checks.push({
    id: "invalid-source-ids",
    label: "Invalid or missing Task / Event IDs",
    status: invalidIds ? "warn" : "ok",
    count: invalidIds,
    message: invalidIds
      ? `${invalidIds} row(s) have blank or invalid IDs in column A.`
      : "All task and event IDs look valid.",
    fixable: invalidIds > 0
  });

  checks.push({
    id: "calendar-sync-missing-id",
    label: "Calendar sync on but no Calendar Event ID",
    status: calendarMissingId ? "warn" : "ok",
    count: calendarMissingId,
    message: calendarMissingId
      ? `${calendarMissingId} item(s) are marked for calendar sync but have no linked event ID.`
      : "Calendar-linked items have event IDs or are not flagged for sync."
  });

  checks.push({
    id: "court-confirmation-pending",
    label: "Hearings pending court confirmation",
    status: unconfirmedHearings ? "warn" : "ok",
    count: unconfirmedHearings,
    message: unconfirmedHearings
      ? `${unconfirmedHearings} scheduled hearing(s) still need the secretaries to confirm with the court.`
      : "No hearings waiting for court confirmation."
  });

  const orphans = await findOrphanTaskItems(accessToken, items);
  checks.push({
    id: "orphan-task-items",
    label: "Orphan tasks / hearings (no matching client or firm matter)",
    status: orphans.length ? "warn" : "ok",
    count: orphans.length,
    message: orphans.length
      ? `${orphans.length} open item(s) reference a client/case not on Master List or firm matters.`
      : "All open tasks and hearings match a client or firm matter.",
    fixable: orphans.length > 0
  });

  return checks;
}

export async function repairInvalidSourceIds(accessToken: string): Promise<{ tasks: number; events: number }> {
  return backfillMissingSourceIds(accessToken);
}

export async function repairMissingLedgerTab(accessToken: string, clientCode: string): Promise<void> {
  const found = await findMasterRow(accessToken, clientCode);
  if (!found) throw new Error("Client not found.");
  if (await sheetExists(accessToken, clientCode)) return;
  const { repairClientLedgerTab } = await import("@/lib/sheets/clients-create");
  await repairClientLedgerTab(accessToken, clientCode);
}
