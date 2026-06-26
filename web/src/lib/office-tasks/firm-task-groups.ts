import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { parseTaskEventLink } from "@/lib/office-tasks/event-item-links";
import { TAX_COMPLIANCE_CLIENT_CASE } from "@/lib/office-tasks/firm-matters";
import { TAX_DEADLINE_DEFS } from "@/lib/tax-deadlines";
import { isOwnerAdminAssigneeAlias } from "@/lib/staff-assignee";

const PREP_TASK_TEXT_RE =
  /\bprep checklist for\b|\bfiling prep for\b|\bthis task is due \d+ days? before\b/i;

function looksLikePrepReminderTask(item: Pick<OfficeItem, "source" | "details" | "remarks">): boolean {
  if (item.source !== "Task") return false;
  if (parseTaskEventLink(item.remarks || "")?.kind === "reminder") return true;
  return PREP_TASK_TEXT_RE.test(String(item.details || ""));
}

export { TAX_COMPLIANCE_CLIENT_CASE } from "@/lib/office-tasks/firm-matters";

const TAX_FORM_PREFIXES = TAX_DEADLINE_DEFS.map((def) => def.form.toUpperCase());

function splitAssignees(value: string): string[] {
  return String(value || "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function itemHaystack(item: OfficeItem): string {
  return `${item.clientCase} ${item.details} ${item.remarks} ${item.venue} ${item.category}`.toLowerCase();
}

/** BIR / tax filing items (Tools tracker, autopilot, or Tax Compliance matter). */
export function isTaxComplianceItem(item: OfficeItem): boolean {
  const clientCase = item.clientCase.trim().toLowerCase();
  if (clientCase === TAX_COMPLIANCE_CLIENT_CASE.toLowerCase() || clientCase.includes("tax compliance")) {
    return true;
  }

  const haystack = itemHaystack(item);
  if (haystack.includes("bir_autopilot") || haystack.includes("bir /") || haystack.includes("ebirforms")) {
    return true;
  }

  const details = item.details.trim().toUpperCase();
  if (details && TAX_FORM_PREFIXES.some((form) => details.startsWith(form) || details.includes(`${form} -`))) {
    return true;
  }

  return item.category.toLowerCase().includes("filing") && haystack.includes("bir");
}

/** Filing prep checklist tasks — Andrea's ops queue, not court/client matters. */
export function isFilingPrepItem(item: OfficeItem): boolean {
  if (item.source !== "Task") return false;
  if (looksLikePrepReminderTask(item)) return true;
  return item.category.trim().toLowerCase() === "filing prep";
}

/** Billing, SOA/AR, engagement/contract delivery, and filing prep — Andrea's queue. */
export function isAndreaOperationsItem(item: OfficeItem): boolean {
  if (isFilingPrepItem(item)) return true;
  if (item.remarks.includes("BILLING_TRIGGER")) return true;

  const haystack = `${item.details} ${item.nextAction} ${item.clientCase}`.toLowerCase();

  if (
    /soa sent|statement of account|acknowledgment receipt|\bar sent\b|payment recorded|collection follow-up|billing follow|confirm ar|generate ar/.test(
      haystack
    )
  ) {
    return true;
  }

  if (
    /engagement letter|contract for legal|litigation contract|legal services agreement|send contract|send agreement|prepare and send contract|prepare and send engagement/.test(
      haystack
    )
  ) {
    return true;
  }

  return false;
}

/** Firm-wide admin work on the owner profile — excludes tax compliance and Andrea ops. */
export function isFirmAdminItem(item: OfficeItem): boolean {
  if (isTaxComplianceItem(item)) return false;
  if (isAndreaOperationsItem(item)) return false;

  if (splitAssignees(item.assignedTo).some((name) => isOwnerAdminAssigneeAlias(name))) {
    return true;
  }

  const clientCase = item.clientCase.trim().toLowerCase();
  if (clientCase === "admin" || clientCase === "office" || clientCase === "firm admin") {
    return true;
  }

  return false;
}

export type FirmOwnerItemBuckets = {
  taxCompliance: OfficeItem[];
  adminTasks: OfficeItem[];
  clientMatters: OfficeItem[];
};

export function partitionFirmOwnerItems(items: OfficeItem[]): FirmOwnerItemBuckets {
  const taxCompliance: OfficeItem[] = [];
  const adminTasks: OfficeItem[] = [];
  const clientMatters: OfficeItem[] = [];

  for (const item of items) {
    if (isTaxComplianceItem(item)) taxCompliance.push(item);
    else if (isFirmAdminItem(item)) adminTasks.push(item);
    else clientMatters.push(item);
  }

  return { taxCompliance, adminTasks, clientMatters };
}

export type AndreaItemBuckets = {
  operations: OfficeItem[];
  clientMatters: OfficeItem[];
};

export function partitionAndreaItems(items: OfficeItem[]): AndreaItemBuckets {
  const operations: OfficeItem[] = [];
  const clientMatters: OfficeItem[] = [];

  for (const item of items) {
    if (isAndreaOperationsItem(item)) operations.push(item);
    else clientMatters.push(item);
  }

  return { operations, clientMatters };
}
