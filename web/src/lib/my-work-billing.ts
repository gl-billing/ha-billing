import { isAdminEmail } from "@/lib/admin";
import { isSecretaryNavUser } from "@/lib/app-access";
import type { FollowUpClient, HomeDashboard, PendingArEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { formatStaffDisplayName } from "@/lib/user-display";
import { canonicalizeStaffName } from "@/lib/staff-assignee";

export type MyWorkBillingScope = "firm" | "assigned";

export type MyWorkBillingClient = {
  id: string;
  code: string;
  name: string;
  meta: string;
};

export type MyWorkBillingSummary = {
  scope: MyWorkBillingScope;
  overdueCount: number;
  followUpCount: number;
  pendingArCount: number;
  overdue: MyWorkBillingClient[];
  followUp: MyWorkBillingClient[];
  pendingAr: MyWorkBillingClient[];
};

function assigneeTokens(name: string | null | undefined, email: string | null | undefined): string[] {
  const tokens = new Set<string>();
  const display = formatStaffDisplayName(name, email).trim().toLowerCase();
  const raw = name?.trim().toLowerCase() ?? "";
  if (display) tokens.add(display);
  if (raw) tokens.add(raw);
  const first = raw.split(/\s+/)[0];
  if (first) tokens.add(first);
  if (display.includes("andrea") || raw.includes("ellyza")) tokens.add("andrea");
  return Array.from(tokens).filter(Boolean);
}

export function isFirmWideBillingScope(
  email: string | null | undefined,
  name: string | null | undefined
): boolean {
  if (isAdminEmail(email)) return true;
  if (isSecretaryNavUser(email)) return true;
  const label = formatStaffDisplayName(name, email).toLowerCase();
  if (label.includes("shiela") || label.includes("andrea")) return true;
  const raw = name?.trim().toLowerCase() ?? "";
  if (raw.includes("ellyza") || raw.includes("shiela")) return true;
  const secretaryEmail =
    process.env.SECRETARY_EMAIL?.trim().toLowerCase() ||
    process.env.ANDREA_EMAIL?.trim().toLowerCase();
  if (secretaryEmail && email?.trim().toLowerCase() === secretaryEmail) return true;
  return false;
}

function rowAssignedAttorney(row: unknown[]): string {
  return String(row[22] || "").trim();
}

function masterRowMatchesAssignee(row: unknown[], tokens: string[], roster: string[]): boolean {
  const assigned = canonicalizeStaffName(rowAssignedAttorney(row), roster).trim().toLowerCase();
  if (!assigned) return false;
  return tokens.some(
    (token) =>
      assigned.includes(token) ||
      token.includes(assigned) ||
      assigned.split(/\s+/)[0] === token
  );
}

function filterOverdue(
  list: HomeDashboard["overdueList"],
  scope: MyWorkBillingScope,
  tokens: string[],
  master: unknown[][],
  roster: string[]
): typeof list {
  if (scope === "firm") return list;
  const codes = new Set(
    master
      .filter((row) => row[0] && masterRowMatchesAssignee(row, tokens, roster))
      .map((row) => String(row[0]).trim().toUpperCase())
  );
  return list.filter((item) => codes.has(item.code.trim().toUpperCase()));
}

function filterFollowUp(
  list: FollowUpClient[],
  scope: MyWorkBillingScope,
  tokens: string[],
  master: unknown[][],
  roster: string[]
): FollowUpClient[] {
  if (scope === "firm") return list;
  const codes = new Set(
    master
      .filter((row) => row[0] && masterRowMatchesAssignee(row, tokens, roster))
      .map((row) => String(row[0]).trim().toUpperCase())
  );
  return list.filter((item) => codes.has(item.code.trim().toUpperCase()));
}

function filterPendingAr(
  list: PendingArEntry[],
  scope: MyWorkBillingScope,
  tokens: string[],
  master: unknown[][],
  roster: string[]
): PendingArEntry[] {
  if (scope === "firm") return list;
  const codes = new Set(
    master
      .filter((row) => row[0] && masterRowMatchesAssignee(row, tokens, roster))
      .map((row) => String(row[0]).trim().toUpperCase())
  );
  return list.filter((item) => codes.has(item.clientCode.trim().toUpperCase()));
}

export function buildMyWorkBillingSummary(
  dashboard: HomeDashboard,
  master: unknown[][],
  options: {
    email: string | null | undefined;
    name: string | null | undefined;
    roster?: string[];
  }
): MyWorkBillingSummary {
  const scope: MyWorkBillingScope = isFirmWideBillingScope(options.email, options.name)
    ? "firm"
    : "assigned";
  const tokens = assigneeTokens(options.name, options.email);
  const roster = options.roster ?? [];

  const overdueList = filterOverdue(dashboard.overdueList, scope, tokens, master, roster);
  const followUpList = filterFollowUp(dashboard.followUpThisWeek, scope, tokens, master, roster);
  const pendingArList = filterPendingAr(dashboard.pendingAr, scope, tokens, master, roster);

  return {
    scope,
    overdueCount: overdueList.length,
    followUpCount: followUpList.length,
    pendingArCount: pendingArList.length,
    overdue: overdueList.slice(0, 5).map((c) => ({
      id: `${c.code}-overdue`,
      code: c.code,
      name: c.name,
      meta: `${c.caseTitle} · overdue · ${formatPeso(c.totalDue)}`
    })),
    followUp: followUpList.slice(0, 5).map((c) => ({
      id: `${c.code}-follow-${c.nextFollowUp}`,
      code: c.code,
      name: c.name,
      meta: `Follow-up ${c.nextFollowUp} · ${formatPeso(c.balance)}`
    })),
    pendingAr: pendingArList.slice(0, 5).map((p) => ({
      id: `${p.clientCode}-ar-${p.sheetRow}`,
      code: p.clientCode,
      name: p.clientName,
      meta: `${p.date} · ${formatPeso(p.amount)} · needs AR`
    }))
  };
}
