import { clientCodeFromCase, parseExplicitLabelCode } from "@/lib/office-tasks/client-matter";
import { formatClientCaseLabel, formatPeso } from "@/lib/gl-config";
import { invalidateCache } from "@/lib/sheets/cache";
import { setItemDone } from "@/lib/office-tasks/sheets/complete";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isItemOpen } from "@/lib/office-tasks/schedule";
import type { DocumentLogEntry } from "@/lib/gl-config";
import { getDocumentLog } from "@/lib/sheets/document-log";
import { findMasterRow, getAllMasterRows } from "@/lib/sheets/master";

const SOA_FOLLOW_UP_DESCRIPTION = "soa sent — schedule collection follow-up";
const SOA_MARKER_RE = /BILLING_TRIGGER:SOA:([A-Z0-9_-]+):/i;

function invalidateTasksAfterSoaClose(accessToken: string): void {
  invalidateCache(accessToken, "tasks-items");
  invalidateCache(accessToken, "tasks-home");
  invalidateCache(accessToken, "tasks-repairs-done");
  invalidateCache(accessToken, "office-hub-summary");
  invalidateCache(accessToken, "health-checks");
}

export type SoaDuplicateCheck = {
  hasPriorSoa: boolean;
  shouldWarnDuplicate: boolean;
  lastSoaDate: string;
  lastSoaAmount: number;
  currentAmount: number;
  warningMessage: string | null;
  infoMessage: string | null;
};

export function amountsMatch(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= epsilon;
}

function isSentSoaEntry(entry: DocumentLogEntry): boolean {
  const type = entry.documentType.toUpperCase();
  if (!type.includes("SOA")) return false;
  const status = entry.status.toLowerCase();
  return status === "sent" || status.includes("sent");
}

export async function getLastSentSoa(
  accessToken: string,
  clientCode: string
): Promise<DocumentLogEntry | null> {
  const entries = await getDocumentLog(accessToken, { clientCode, limit: 40 });
  return entries.find(isSentSoaEntry) ?? null;
}

function formatMasterSoaDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export async function checkSoaDuplicateWarning(
  accessToken: string,
  clientCode: string,
  currentAmount: number
): Promise<SoaDuplicateCheck> {
  const current = Number(currentAmount) || 0;
  let lastSoa = await getLastSentSoa(accessToken, clientCode);
  let lastDate = lastSoa?.timestamp || "";
  let lastAmount = Number(lastSoa?.amount) || 0;

  if (!lastSoa) {
    const found = await findMasterRow(accessToken, clientCode);
    const soaSent = String(found?.values[12] || "").trim();
    if (soaSent) {
      lastDate = formatMasterSoaDate(soaSent);
      lastAmount = current;
      lastSoa = { timestamp: lastDate, amount: lastAmount } as DocumentLogEntry;
    }
  }

  if (!lastSoa) {
    return {
      hasPriorSoa: false,
      shouldWarnDuplicate: false,
      lastSoaDate: "",
      lastSoaAmount: 0,
      currentAmount: current,
      warningMessage: null,
      infoMessage: null
    };
  }

  const sameAmount = amountsMatch(lastAmount, current);

  return {
    hasPriorSoa: true,
    shouldWarnDuplicate: sameAmount,
    lastSoaDate: lastDate,
    lastSoaAmount: lastAmount,
    currentAmount: current,
    warningMessage: sameAmount
      ? `A SOA was already issued on ${lastDate} for ${formatPeso(lastAmount)}. The balance is still ${formatPeso(current)}.`
      : null,
    infoMessage: sameAmount
      ? `SOA already issued on ${lastDate} for ${formatPeso(lastAmount)}.`
      : `Last SOA issued on ${lastDate} for ${formatPeso(lastAmount)}. Current balance is ${formatPeso(current)}.`
  };
}

function normalizeClientCode(clientCode: string): string {
  return clientCode.trim().toUpperCase();
}

function clientCodeFromSoaMarker(remarks: string): string | null {
  const match = String(remarks || "").match(SOA_MARKER_RE);
  return match ? normalizeClientCode(match[1]) : null;
}

function buildClientCaseIndex(rows: unknown[][]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const code = normalizeClientCode(String(row[0] || ""));
    if (!code) continue;
    const name = String(row[1] || "").trim();
    const caseTitle = String(row[2] || "").trim();
    const keys = [
      formatClientCaseLabel(name, caseTitle).toLowerCase(),
      name.toLowerCase(),
      code.toLowerCase(),
      clientCodeFromCase(name).toLowerCase()
    ].filter(Boolean);
    for (const key of keys) {
      if (!index.has(key)) index.set(key, code);
    }
  }
  return index;
}

function balanceForClientCode(rows: unknown[][], clientCode: string): number {
  const code = normalizeClientCode(clientCode);
  const row = rows.find((entry) => normalizeClientCode(String(entry[0] || "")) === code);
  return row ? Number(row[11]) || 0 : 0;
}

export function isSoaFollowUpTaskItem(item: OfficeItem): boolean {
  if (item.source !== "Task" || !isItemOpen(item)) return false;
  if (SOA_MARKER_RE.test(item.remarks)) return true;

  const details = item.details.trim().toLowerCase();
  const haystack = `${item.details} ${item.nextAction}`.toLowerCase();
  return (
    details === SOA_FOLLOW_UP_DESCRIPTION ||
    /soa sent — schedule collection follow-up|follow up on payment within 7 days/.test(haystack)
  );
}

export function resolveClientCodeForSoaTask(
  item: OfficeItem,
  caseIndex: Map<string, string>
): string | null {
  const fromMarker = clientCodeFromSoaMarker(item.remarks);
  if (fromMarker) return fromMarker;

  const explicit = parseExplicitLabelCode(item.clientCase);
  if (explicit) return explicit;

  const clientCase = item.clientCase.trim().toLowerCase();
  if (!clientCase) return null;

  const fromIndex = caseIndex.get(clientCase);
  if (fromIndex) return fromIndex;

  const fromPrefix = clientCodeFromCase(item.clientCase).toUpperCase();
  return caseIndex.get(fromPrefix.toLowerCase()) ?? null;
}

function isSoaFollowUpTask(item: OfficeItem, clientCode: string, caseIndex: Map<string, string>): boolean {
  if (!isSoaFollowUpTaskItem(item)) return false;
  const normalized = normalizeClientCode(clientCode);
  const fromMarker = clientCodeFromSoaMarker(item.remarks);
  if (fromMarker === normalized) return true;
  const resolved = resolveClientCodeForSoaTask(item, caseIndex);
  return resolved === normalized;
}

/** When multiple open SOA follow-ups exist for one client, keep the newest and close the rest. */
export function duplicateSoaFollowUpsToClose(
  items: OfficeItem[],
  caseIndex: Map<string, string>
): OfficeItem[] {
  const grouped = new Map<string, OfficeItem[]>();

  for (const item of items) {
    if (!isSoaFollowUpTaskItem(item)) continue;
    const fromMarker = clientCodeFromSoaMarker(item.remarks);
    const clientCode = fromMarker || resolveClientCodeForSoaTask(item, caseIndex);
    if (!clientCode) continue;
    const list = grouped.get(clientCode) || [];
    list.push(item);
    grouped.set(clientCode, list);
  }

  const toClose: OfficeItem[] = [];
  for (const tasks of grouped.values()) {
    if (tasks.length <= 1) continue;
    const keep = [...tasks].sort((a, b) =>
      (b.lastUpdated || b.date || "").localeCompare(a.lastUpdated || a.date || "")
    )[0];
    toClose.push(...tasks.filter((task) => task.id !== keep.id));
  }

  return toClose;
}

export async function collapseDuplicateOpenSoaFollowUps(accessToken: string): Promise<number> {
  const [items, rows] = await Promise.all([collectAllItems(accessToken), getAllMasterRows(accessToken)]);
  const caseIndex = buildClientCaseIndex(rows);
  const toClose = duplicateSoaFollowUpsToClose(items, caseIndex);
  for (const item of toClose) {
    await setItemDone(accessToken, "Task", item.rowNumber, true);
  }
  if (toClose.length > 0) {
    invalidateTasksAfterSoaClose(accessToken);
  }
  return toClose.length;
}

/** Close open SOA collection follow-up tasks for this client. */
export async function closeSoaFollowUpTasks(
  accessToken: string,
  clientCode: string
): Promise<number> {
  const [items, rows] = await Promise.all([collectAllItems(accessToken), getAllMasterRows(accessToken)]);
  const caseIndex = buildClientCaseIndex(rows);
  let closed = 0;

  for (const item of items) {
    if (!isSoaFollowUpTask(item, clientCode, caseIndex)) continue;
    await setItemDone(accessToken, "Task", item.rowNumber, true);
    closed += 1;
  }

  if (closed > 0) {
    invalidateTasksAfterSoaClose(accessToken);
  }

  return closed;
}

/**
 * Close stale SOA follow-up tasks when a SOA was already issued for the same balance.
 * Runs automatically (throttled) when Office Tasks loads.
 */
export async function reconcileSoaFollowUpTasks(accessToken: string): Promise<number> {
  const [items, rows] = await Promise.all([collectAllItems(accessToken), getAllMasterRows(accessToken)]);
  const caseIndex = buildClientCaseIndex(rows);
  const checks = new Map<string, SoaDuplicateCheck>();
  let closed = 0;

  for (const item of items) {
    if (!isSoaFollowUpTaskItem(item)) continue;

    const fromMarker = clientCodeFromSoaMarker(item.remarks);
    const clientCode = fromMarker || resolveClientCodeForSoaTask(item, caseIndex);
    if (!clientCode) continue;

    let check = checks.get(clientCode);
    if (!check) {
      const balance = balanceForClientCode(rows, clientCode);
      check = await checkSoaDuplicateWarning(accessToken, clientCode, balance);
      checks.set(clientCode, check);
    }

    if (!check.hasPriorSoa || !check.shouldWarnDuplicate) continue;

    await setItemDone(accessToken, "Task", item.rowNumber, true);
    closed += 1;
  }

  if (closed > 0) {
    invalidateTasksAfterSoaClose(accessToken);
  }

  return closed;
}

export type SoaSentFollowUpResult = {
  followUpsClosed: number;
  followUpTaskCreated: boolean;
  note: string | null;
};

/** After a successful SOA send: close old reminders; only create a new one when billing amount changed. */
export async function handleSoaSentFollowUp(
  accessToken: string,
  clientCode: string,
  currentAmount: number,
  priorCheck: SoaDuplicateCheck,
  createFollowUpTask: () => Promise<string | null>
): Promise<SoaSentFollowUpResult> {
  const followUpsClosed = await closeSoaFollowUpTasks(accessToken, clientCode);

  const isRepeatSameAmount =
    priorCheck.hasPriorSoa && amountsMatch(priorCheck.lastSoaAmount, currentAmount);

  if (isRepeatSameAmount) {
    return {
      followUpsClosed,
      followUpTaskCreated: false,
      note:
        priorCheck.infoMessage ||
        `SOA already issued for ${formatPeso(currentAmount)} — no new follow-up task created.`
    };
  }

  const taskId = await createFollowUpTask();
  const dedupedClosed = await collapseDuplicateOpenSoaFollowUps(accessToken).catch(() => 0);
  return {
    followUpsClosed: followUpsClosed + dedupedClosed,
    followUpTaskCreated: Boolean(taskId),
    note: null
  };
}
