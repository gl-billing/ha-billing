import type { ClientSummary } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { groupItemsByClientCode, matterClientContextFromDetail } from "@/lib/office-tasks/client-matter";

export type MatterFamilyMember = Pick<
  ClientSummary,
  | "code"
  | "name"
  | "caseTitle"
  | "caseNumber"
  | "matterType"
  | "balance"
  | "status"
  | "accountStatus"
  | "nextFollowUp"
  | "parentClientCode"
  | "matterStage"
  | "courtPending"
  | "intakePathDetails"
>;

/** Home billing code — first file has no parent; children point to it. */
export function matterFamilyRootFromCode(code: string): string {
  const normalized = String(code ?? "").trim().toUpperCase();
  const match = normalized.match(/^(.+)-(\d+)$/);
  if (match) return match[1];
  return normalized;
}

export function resolveMatterFamilyRoot(client: Pick<ClientSummary, "code" | "parentClientCode">): string {
  const parent = String(client.parentClientCode ?? "").trim().toUpperCase();
  if (parent) return parent;
  return matterFamilyRootFromCode(client.code);
}

export function matterCodesShareFamily(a: string, b: string): boolean {
  return matterFamilyRootFromCode(a) === matterFamilyRootFromCode(b);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matterSuffixNumber(code: string, rootCode: string): number {
  const root = rootCode.trim().toUpperCase();
  const normalized = code.trim().toUpperCase();
  if (normalized === root) return 1;
  const match = normalized.match(new RegExp(`^${escapeRegExp(root)}-(\\d+)$`));
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) || Number.MAX_SAFE_INTEGER;
}

export function listMatterFamilyMembers(
  clients: ClientSummary[],
  code: string
): MatterFamilyMember[] {
  const target = clients.find((row) => row.code.trim().toUpperCase() === code.trim().toUpperCase());
  const rootCode = target
    ? resolveMatterFamilyRoot(target)
    : code.trim().toUpperCase();

  return clients
    .filter((row) => {
      const rowCode = row.code.trim().toUpperCase();
      const parent = String(row.parentClientCode ?? "").trim().toUpperCase();
      return rowCode === rootCode || parent === rootCode;
    })
    .sort((a, b) => matterSuffixNumber(a.code, rootCode) - matterSuffixNumber(b.code, rootCode))
    .map((row) => ({
      code: row.code,
      name: row.name,
      caseTitle: row.caseTitle,
      caseNumber: row.caseNumber,
      matterType: row.matterType,
      balance: row.balance,
      status: row.status,
      accountStatus: row.accountStatus,
      nextFollowUp: row.nextFollowUp,
      parentClientCode: row.parentClientCode,
      matterStage: row.matterStage,
      courtPending: row.courtPending,
      intakePathDetails: row.intakePathDetails
    }));
}

export function nextSequentialMatterCode(rootCode: string, familyMembers: MatterFamilyMember[]): string {
  const root = rootCode.trim().toUpperCase();
  let maxSuffix = 1;
  for (const member of familyMembers) {
    const suffix = matterSuffixNumber(member.code, root);
    if (suffix !== Number.MAX_SAFE_INTEGER) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }
  const next = maxSuffix < 2 ? 2 : maxSuffix + 1;
  return `${root}-${next}`;
}

export function siblingBillingCodesForMember(
  members: Array<Pick<MatterFamilyMember, "code">>,
  matterCode: string
): string[] {
  const matter = matterCode.trim().toUpperCase();
  return members.map((row) => row.code.trim().toUpperCase()).filter((code) => code && code !== matter);
}

export function aggregateFamilyOpenCounts(
  items: OfficeItem[],
  members: MatterFamilyMember[]
): { openTasks: number; openEvents: number } {
  const taskIds = new Set<string>();
  const eventIds = new Set<string>();

  for (const member of members) {
    const context = matterClientContextFromDetail({
      code: member.code,
      name: member.name,
      caseTitle: member.caseTitle,
      caseNumber: member.caseNumber
    });
    const taskGroup = member.code.trim().toUpperCase();
    const { tasks, events } = groupItemsByClientCode(items, member.code, taskGroup, context);
    for (const task of tasks) taskIds.add(task.id);
    for (const event of events) eventIds.add(event.id);
  }

  let openTasks = 0;
  let openEvents = 0;
  for (const item of items) {
    if (item.done) continue;
    if (item.source === "Task" && taskIds.has(item.id)) openTasks += 1;
    if (item.source === "Event" && eventIds.has(item.id)) openEvents += 1;
  }

  return { openTasks, openEvents };
}

export function matterFamilyListSubtitle(member: MatterFamilyMember, homeCode: string): string {
  const code = member.code.trim().toUpperCase();
  const home = homeCode.trim().toUpperCase();
  if (code === home) return `Primary matter · ${code}`;
  return `${code.replace(`${home}-`, "Matter ")} · ${code}`;
}

export function matterFamilyTabLabel(member: MatterFamilyMember, homeCode: string): string {
  const code = member.code.trim().toUpperCase();
  const home = homeCode.trim().toUpperCase();
  const title = member.caseTitle?.trim();
  if (code === home) {
    if (title) return title.length > 24 ? `${title.slice(0, 21)}…` : title;
    return "Primary matter";
  }
  if (title) return title.length > 28 ? `${title.slice(0, 25)}…` : title;
  return code.replace(`${home}-`, "Matter ");
}
