/**
 * Client-safe helpers for the Filing workspace table (columns, urgency, sort).
 */

import { parseSheetDateOnly, todayYmd } from "@/lib/office-tasks/date-only";
import type { FilingQueueRow } from "@/lib/office-tasks/filing-queue-types";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";

export type FilingUrgency = "overdue" | "due-today" | "later" | "none";

export type FilingColumnId =
  | "select"
  | "created"
  | "eventId"
  | "clientCode"
  | "pleading"
  | "clientParty"
  | "whereFiled"
  | "courtAddress"
  | "courtEmail"
  | "copyFurnished"
  | "manner"
  | "assignedTo"
  | "status"
  | "deadline"
  | "dateFiled"
  | "trackingOrAck"
  | "proof"
  | "notes"
  | "clientCase"
  | "actions";

export type FilingColumnDef = {
  id: FilingColumnId;
  label: string;
  sticky?: boolean;
  stickyOffset?: string;
};

export const FILING_COLUMN_DEFS: FilingColumnDef[] = [
  { id: "select", label: "", sticky: true, stickyOffset: "0" },
  { id: "created", label: "Created" },
  { id: "eventId", label: "Event ID" },
  { id: "clientCode", label: "Client code" },
  { id: "pleading", label: "Pleading", sticky: true, stickyOffset: "2.5rem" },
  { id: "clientParty", label: "Client / party", sticky: true, stickyOffset: "13.5rem" },
  { id: "whereFiled", label: "Where filed" },
  { id: "courtAddress", label: "Court address" },
  { id: "courtEmail", label: "Court email" },
  { id: "copyFurnished", label: "Copy furnished" },
  { id: "manner", label: "Manner" },
  { id: "assignedTo", label: "Assigned to" },
  { id: "status", label: "Status", sticky: true, stickyOffset: "24.5rem" },
  { id: "deadline", label: "Deadline" },
  { id: "dateFiled", label: "Date filed" },
  { id: "trackingOrAck", label: "Tracking / ACK" },
  { id: "proof", label: "Proof" },
  { id: "notes", label: "Notes" },
  { id: "clientCase", label: "Client case" },
  { id: "actions", label: "Actions" }
];

const ALWAYS: FilingColumnId[] = ["select", "pleading", "clientParty", "status", "actions"];

const E_FILING_DEFAULT: FilingColumnId[] = [
  ...ALWAYS,
  "whereFiled",
  "courtEmail",
  "copyFurnished",
  "assignedTo",
  "deadline",
  "dateFiled",
  "trackingOrAck",
  "proof",
  "notes",
  "clientCase"
];

const PHYSICAL_DEFAULT: FilingColumnId[] = [
  ...ALWAYS,
  "whereFiled",
  "courtAddress",
  "copyFurnished",
  "manner",
  "assignedTo",
  "deadline",
  "dateFiled",
  "trackingOrAck",
  "proof",
  "notes",
  "clientCase"
];

export function filingColumnsForQueue(
  queue: FilingQueueKind,
  showAllColumns: boolean
): FilingColumnDef[] {
  if (showAllColumns) return FILING_COLUMN_DEFS;
  const ids = new Set(queue === "e-filing" ? E_FILING_DEFAULT : PHYSICAL_DEFAULT);
  return FILING_COLUMN_DEFS.filter((col) => ids.has(col.id));
}

export function filingDeadlineYmd(deadline: string): string | null {
  return parseSheetDateOnly(deadline);
}

export function filingRowUrgency(row: FilingQueueRow, today = todayYmd()): FilingUrgency {
  const ymd = filingDeadlineYmd(row.deadline);
  if (!ymd) return "none";
  const terminal = /filed\/served|proof complete/i.test(String(row.status || ""));
  if (terminal) return "later";
  if (ymd < today) return "overdue";
  if (ymd === today) return "due-today";
  return "later";
}

export function filingUrgencyLabel(urgency: FilingUrgency): string {
  switch (urgency) {
    case "overdue":
      return "Overdue";
    case "due-today":
      return "Due today";
    case "later":
      return "Later";
    default:
      return "No deadline";
  }
}

export function filingStatusShortLabel(status: string): string {
  switch (status) {
    case "Filed/served":
      return "Filed";
    case "Proof complete":
      return "Proof";
    default:
      return status;
  }
}

export function sortFilingRowsByDeadline(rows: FilingQueueRow[]): FilingQueueRow[] {
  return [...rows].sort((a, b) => {
    const da = filingDeadlineYmd(a.deadline) || "9999-99-99";
    const db = filingDeadlineYmd(b.deadline) || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.sheetRow - b.sheetRow;
  });
}

export function countFilingStatusStrip(rows: FilingQueueRow[], today = todayYmd()) {
  let queued = 0;
  let out = 0;
  let filed = 0;
  let proof = 0;
  let overdue = 0;
  for (const row of rows) {
    const status = String(row.status || "").trim();
    if (status === "Queued") queued += 1;
    else if (status === "Out") out += 1;
    else if (status === "Filed/served") filed += 1;
    else if (status === "Proof complete") proof += 1;
    if (filingRowUrgency(row, today) === "overdue") overdue += 1;
  }
  return { queued, out, filed, proof, overdue };
}

export function countFilingQueues(rows: FilingQueueRow[]) {
  let eFiling = 0;
  let physical = 0;
  for (const row of rows) {
    if (row.queue === "physical") physical += 1;
    else eFiling += 1;
  }
  return { eFiling, physical };
}

export function assigneeMatchesStaff(assignedTo: string, staffName: string): boolean {
  const staff = staffName.trim().toLowerCase();
  if (!staff) return false;
  return String(assignedTo || "")
    .split(/[,;]+/)
    .map((p) => p.trim().toLowerCase())
    .some((part) => part === staff || part.includes(staff) || staff.includes(part));
}
