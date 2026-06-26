import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { formatClientCaseLabel } from "@/lib/gl-config";
import {
  caseNumbersAlign,
  clientCaseIdentityMatchesBilling,
  clientCodeFromCase,
  inferCaseDiscriminatorFromBillingCode,
  labelLeadingSegmentLooksLikeCaseTitle,
  officeItemsShareClientCaseLabel,
  parseClientCaseDisplay,
  parseClientCodeFromSourceId,
  parseExplicitLabelCode
} from "@/lib/office-tasks/client-case-identity";
export {
  caseNumbersAlign,
  caseTitleTokensFullyInLabel,
  clientCaseIdentityMatchesBilling,
  clientCodeFromCase,
  clientNameTokensInLabel,
  inferCaseDiscriminatorFromBillingCode,
  labelCaseCaptionConflictsWithBilling,
  labelExpressesCaseCaption,
  labelLeadingSegmentLooksLikeCaseTitle,
  officeItemsShareClientCaseLabel,
  parseClientCaseDisplay,
  parseClientCodeFromSourceId,
  parseExplicitLabelCode
} from "@/lib/office-tasks/client-case-identity";
import { parseEventTaskLinks, parseTaskEventLink } from "@/lib/office-tasks/event-item-links";
import { looksLikePrepReminderTask, parseFilingDeadlineFromPrepText, resolveFilingEventForPrepTask } from "@/lib/office-tasks/prep-task-event-link";
import { getFirmMatterByCode } from "@/lib/office-tasks/firm-matters";

/**
 * Tasks sheet groups by 3-letter prefix from case name; billing may use a longer Master List code.
 * Use this when merging tasks into a billing client's timeline.
 */
export function taskCodeForBillingClient(detail: {
  code: string;
  caseTitle?: string;
  name?: string;
}): string {
  const code = detail.code.trim().toUpperCase();
  if (code.length <= 3) return code;

  const fromName = detail.name?.trim() ? clientCodeFromCase(detail.name) : "";
  if (fromName) return fromName;

  const fromCase = detail.caseTitle?.trim() ? clientCodeFromCase(detail.caseTitle) : "";
  return fromCase || code.slice(0, 3);
}

/** Prefer client / case name — not a stale or wrong ID prefix in column A. */
export function resolveClientCode(item: Pick<OfficeItem, "id" | "clientCase">): string | null {
  const label = item.clientCase?.trim();
  if (label) return clientCodeFromCase(label);
  return parseClientCodeFromSourceId(item.id);
}

/** Client code for alphabetical task/event lists — honors an explicit code prefix before " — ". */
export function clientCodeForSort(item: Pick<OfficeItem, "id" | "clientCase">): string {
  const label = item.clientCase?.trim();
  if (label) {
    const first = label.split(/\s+—\s+/)[0]?.trim() || "";
    if (/^[A-Z][A-Z0-9_-]{1,11}$/i.test(first)) {
      return first.toUpperCase();
    }
  }
  return resolveClientCode(item) || "";
}

export function compareOfficeItemsByClientCode(
  a: Pick<OfficeItem, "id" | "clientCase">,
  b: Pick<OfficeItem, "id" | "clientCase">
): number {
  const byCode = clientCodeForSort(a).localeCompare(clientCodeForSort(b), "en", {
    sensitivity: "base",
    ignorePunctuation: true
  });
  if (byCode !== 0) return byCode;
  return (a.clientCase || "").localeCompare(b.clientCase || "", "en", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

export type MatterClientContext = {
  code: string;
  name?: string;
  caseTitle?: string;
  caseNumber?: string;
};

function normalizeCaseLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function billingTaskPrefixes(detail: MatterClientContext): string[] {
  const billingCode = detail.code.trim().toUpperCase();
  const taskPrefix = clientCodeFromCase(
    formatClientCaseLabel(detail.name || "", detail.caseTitle || "")
  ).toUpperCase();
  const fromName = detail.name?.trim() ? clientCodeFromCase(detail.name).toUpperCase() : "";
  // Sibling matters share a 3-letter task prefix — do not treat the bare name prefix as unique.
  if (detail.caseTitle?.trim()) {
    return [...new Set([billingCode, taskPrefix].filter(Boolean))];
  }
  // Do not add clientCodeFromCase(caseTitle) — "Qualified Theft" and "Qualified Parricide" both → QUA.
  return [...new Set([billingCode, taskPrefix, fromName].filter(Boolean))];
}

function isSharedTaskPrefix(prefix: string, detail: MatterClientContext): boolean {
  return prefix.length <= 3 && Boolean(detail.caseTitle?.trim());
}

function labelConfirmsSharedPrefixMatch(
  detail: MatterClientContext,
  clientCase: string,
  _itemId: string
): boolean {
  return clientCaseIdentityMatchesBilling(detail, clientCase.trim());
}

/**
 * Match a tasks-sheet Client / Case label to a billing client.
 * Requires the threefold identity test: same client name, same case title, and same case
 * number when either side includes one. No prefix-only or surname-only mixing.
 */
export function clientCaseMatchesBillingClient(
  clientCase: string,
  detail: MatterClientContext,
  _itemId = ""
): boolean {
  const raw = clientCase.trim();
  if (!raw) return false;

  const canonical = formatClientCaseLabel(detail.name || "", detail.caseTitle || "");
  if (canonical) {
    const label = raw.toLowerCase();
    const normLabel = normalizeCaseLabel(raw);
    if (label === canonical.toLowerCase() || normLabel === normalizeCaseLabel(canonical)) {
      return caseNumbersAlign(detail.caseNumber, raw);
    }
  }

  return clientCaseIdentityMatchesBilling(detail, raw);
}

function prefixMatchAllowed(
  clientCase: string,
  itemId: string,
  detail: MatterClientContext,
  matchedPrefix: string | null
): boolean {
  if (!matchedPrefix) return false;
  if (!billingTaskPrefixes(detail).includes(matchedPrefix)) return false;
  if (!isSharedTaskPrefix(matchedPrefix, detail)) return true;
  return labelConfirmsSharedPrefixMatch(detail, clientCase, itemId);
}

export function taskBelongsToBillingPrefix(
  clientCase: string,
  itemId: string,
  detail: MatterClientContext
): boolean {
  const explicit = parseExplicitLabelCode(clientCase);
  if (explicit && prefixMatchAllowed(clientCase, itemId, detail, explicit)) return true;
  const fromLabel = clientCodeFromCase(clientCase).toUpperCase();
  if (fromLabel && prefixMatchAllowed(clientCase, itemId, detail, fromLabel)) return true;
  const fromId = parseClientCodeFromSourceId(itemId);
  if (fromId && prefixMatchAllowed(clientCase, itemId, detail, fromId)) return true;
  return false;
}

export function matterClientContextFromDetail(
  detail: { code: string; name?: string; caseTitle?: string; caseNumber?: string } | null | undefined
): MatterClientContext | null {
  if (!detail?.code?.trim()) return null;
  const explicitCaseTitle = detail.caseTitle?.trim() || "";
  const inferredCaseTitle = explicitCaseTitle ? "" : inferCaseDiscriminatorFromBillingCode(detail.code) || "";
  return {
    code: detail.code.trim(),
    name: detail.name?.trim() || undefined,
    caseTitle: explicitCaseTitle || inferredCaseTitle || undefined,
    caseNumber: detail.caseNumber?.trim() || undefined
  };
}

export function idMatchesClientCase(id: string, clientCase: string): boolean {
  const idPrefix = parseClientCodeFromSourceId(id);
  if (!idPrefix) return false;
  return idPrefix === clientCodeFromCase(clientCase);
}

function chronologicalSort(a: OfficeItem, b: OfficeItem): number {
  return (
    (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31") ||
    a.id.localeCompare(b.id) ||
    a.clientCase.localeCompare(b.clientCase)
  );
}

export function matterItemAnchorId(item: Pick<OfficeItem, "source" | "sheetName" | "rowNumber">): string {
  return `matter-item-${item.source}-${item.sheetName}-${item.rowNumber}`;
}

/** Tasks sheet prefix for a matter URL code, optionally refined from billing detail. */
export function resolveTaskGroupCode(
  matterCode: string,
  detail?: { code: string; caseTitle?: string; name?: string } | null
): string {
  if (detail?.code?.trim()) return taskCodeForBillingClient(detail);
  const upper = matterCode.trim().toUpperCase();
  if (!upper) return upper;
  const firm = getFirmMatterByCode(upper);
  if (firm) return firm.code;
  if (upper.length <= 3) return upper;
  // Billing Master List codes longer than 3 chars are not task prefixes — wait for billing detail.
  return upper;
}

/** Whether a task/event row belongs on a matter page for the given code. */
export function itemMatchesMatterCode(
  item: Pick<OfficeItem, "id" | "clientCase" | "source">,
  matterCode: string,
  taskGroupCode?: string,
  clientContext?: MatterClientContext | null
): boolean {
  const matter = matterCode.trim().toUpperCase();
  const taskCode = (taskGroupCode ?? matter).trim().toUpperCase();
  if (!matter) return false;

  const caseLabel = item.clientCase?.trim();
  if (clientContext) {
    if (caseLabel && clientCaseMatchesBillingClient(caseLabel, clientContext, item.id)) {
      return true;
    }

    return false;
  }

  const firm = getFirmMatterByCode(matter);
  if (firm) {
    const firmCase = item.clientCase?.trim().toLowerCase() || "";
    if (firmCase === firm.clientCase.trim().toLowerCase()) return true;
    if (firmCase.startsWith(firm.clientCase.trim().toLowerCase())) return true;
  }

  const itemTaskCode = resolveClientCode(item);
  if (itemTaskCode) {
    if (itemTaskCode === taskCode || itemTaskCode === matter) return true;
    if (matter.length <= 3 && taskCode.length <= 3 && itemTaskCode === taskCode) return true;
  }

  const idPrefix = parseClientCodeFromSourceId(item.id);
  if (idPrefix) {
    if (idPrefix === taskCode || idPrefix === matter) return true;
    if (matter.length <= 3 && taskCode.length <= 3 && idPrefix === taskCode) return true;
  }

  return false;
}

function includeGroupedTask(
  task: OfficeItem,
  tasks: OfficeItem[],
  matchedTaskIds: Set<string>,
  labels: Set<string>
): void {
  if (matchedTaskIds.has(task.id)) return;
  matchedTaskIds.add(task.id);
  tasks.push(task);
  const label = task.clientCase?.trim();
  if (label) labels.add(label);
}

function includeLinkedTaskForMatter(
  task: OfficeItem,
  tasks: OfficeItem[],
  matchedTaskIds: Set<string>,
  labels: Set<string>,
  clientContext?: MatterClientContext | null,
  linkedViaEvent = false
): void {
  if (
    !linkedViaEvent &&
    clientContext?.name &&
    task.clientCase?.trim() &&
    !clientCaseMatchesBillingClient(task.clientCase, clientContext, task.id)
  ) {
    return;
  }
  includeGroupedTask(task, tasks, matchedTaskIds, labels);
}

/** Pull in filing prep / follow-up tasks linked to events already on this matter. */
function includeEventLinkedTasks(
  items: OfficeItem[],
  matchedEvents: OfficeItem[],
  tasks: OfficeItem[],
  matchedTaskIds: Set<string>,
  labels: Set<string>,
  clientContext?: MatterClientContext | null
): void {
  const eventIds = new Set(matchedEvents.map((event) => event.id));

  for (const event of matchedEvents) {
    const { followUpTaskId, reminderTaskId } = parseEventTaskLinks(event.remarks || "");
    for (const taskId of [followUpTaskId, reminderTaskId]) {
      if (!taskId) continue;
      const task = items.find((row) => row.source === "Task" && row.id === taskId);
      if (task) includeLinkedTaskForMatter(task, tasks, matchedTaskIds, labels, clientContext, true);
    }
  }

  for (const item of items) {
    if (item.source !== "Task" || matchedTaskIds.has(item.id)) continue;
    const link = parseTaskEventLink(item.remarks || "");
    if (!link || !eventIds.has(link.eventId)) continue;
    includeLinkedTaskForMatter(item, tasks, matchedTaskIds, labels, clientContext, true);
  }
}

/** Include filing prep tasks tied to matched events or the billing client, even with stale labels. */
function includePrepTasksForMatter(
  items: OfficeItem[],
  matchedEvents: OfficeItem[],
  tasks: OfficeItem[],
  matchedTaskIds: Set<string>,
  labels: Set<string>,
  clientContext?: MatterClientContext | null
): void {
  const eventIds = new Set(matchedEvents.map((event) => event.id));

  for (const item of items) {
    if (item.source !== "Task" || matchedTaskIds.has(item.id)) continue;

    const linkedEvent = resolveFilingEventForPrepTask(item, items);
    if (linkedEvent && eventIds.has(linkedEvent.id)) {
      includeGroupedTask(item, tasks, matchedTaskIds, labels);
      continue;
    }

    if (!looksLikePrepReminderTask(item)) continue;

    const deadlineHint = parseFilingDeadlineFromPrepText(item.details || "");
    if (
      deadlineHint &&
      clientContext &&
      clientCaseMatchesBillingClient(item.clientCase, clientContext, item.id) &&
      matchedEvents.filter((event) => event.filingDeadline === deadlineHint).length === 1
    ) {
      includeGroupedTask(item, tasks, matchedTaskIds, labels);
    }
  }
}

export function groupItemsByClientCode(
  items: OfficeItem[],
  clientCode: string,
  taskGroupCode?: string,
  clientContext?: MatterClientContext | null
): { tasks: OfficeItem[]; events: OfficeItem[]; clientLabels: string[] } {
  const matterKey = clientContext?.code?.trim() || clientCode;
  const groupCode = resolveTaskGroupCode(matterKey, clientContext ?? null);
  const effectiveTaskCode = taskGroupCode?.trim().toUpperCase() || groupCode;

  if (!clientContext && matterKey.trim().length > 3) {
    return { tasks: [], events: [], clientLabels: [] };
  }
  const tasks: OfficeItem[] = [];
  const events: OfficeItem[] = [];
  const labels = new Set<string>();
  const matchedTaskIds = new Set<string>();

  for (const item of items) {
    if (!itemMatchesMatterCode(item, matterKey, effectiveTaskCode, clientContext)) continue;
    const label = item.clientCase?.trim();
    if (label) labels.add(label);
    if (item.source === "Task") includeGroupedTask(item, tasks, matchedTaskIds, labels);
    else events.push(item);
  }

  includeEventLinkedTasks(items, events, tasks, matchedTaskIds, labels, clientContext);
  includePrepTasksForMatter(items, events, tasks, matchedTaskIds, labels, clientContext);

  tasks.sort(chronologicalSort);
  events.sort(chronologicalSort);

  return {
    tasks,
    events,
    clientLabels: Array.from(labels).sort()
  };
}

export function collectClientCodes(items: OfficeItem[]): string[] {
  const codes = new Set<string>();
  for (const item of items) {
    const code = resolveClientCode(item);
    if (code) codes.add(code);
  }
  return Array.from(codes).sort();
}
