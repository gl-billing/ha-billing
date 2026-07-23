import type { ClientDetail, NewClientPayload } from "@/lib/gl-config";
import { resolveClientMatterType } from "@/lib/client-matter-type";
import { resolveContractAcceptanceFee } from "@/lib/litigation-venue-fees";
import {
  listMatterFamilyMembers,
  nextSequentialMatterCode,
  resolveMatterFamilyRoot,
  type MatterFamilyMember
} from "@/lib/matter-family";

/** Shown as case number until the appellate/agency docket issues. */
export const ELEVATION_PENDING_CASE_NUMBER = "Pending — awaiting docket number";

/** Ledger markers so appeal fees are distinct from trial-court intake acceptance. */
export const APPEAL_ACCEPTANCE_FEE_LEDGER_MARKER = "APPEAL_ACCEPTANCE_FEE";
export const APPEAL_EXPENSE_DEPOSIT_LEDGER_MARKER = "APPEAL_EXPENSE_DEPOSIT";

/** Default expense deposit for elevated matters (contract range PHP 5k–10k). */
export const APPEAL_EXPENSE_DEPOSIT_DEFAULT = 5000;

export const HIGHER_COURT_OPTIONS = [
  "Court of Appeals",
  "Supreme Court",
  "Sandiganbayan",
  "Court of Tax Appeals",
  "NLRC",
  "Other"
] as const;

export type HigherCourtOption = (typeof HIGHER_COURT_OPTIONS)[number];

export type MatterElevationDetails = {
  fromCode: string;
  fromCaseNumber: string;
  fromCourtPending: string;
  fromCaseTitle: string;
  higherCourt: string;
  awaitingCaseNumber: boolean;
  elevatedAt: string;
};

export type ElevateCourtInput = {
  higherCourt: string;
  higherCourtOther?: string;
  caseTitle?: string;
  caseNumber?: string;
  /** @deprecated No longer marks the trial file as appeal; kept for API compat. */
  markSourceAsAppeal?: boolean;
};

export type ElevationFeeDraft = {
  category: string;
  description: string;
  amount: string;
};

export function resolveHigherCourtLabel(higherCourt: string, higherCourtOther?: string): string {
  const selected = higherCourt.trim();
  if (/^other$/i.test(selected)) {
    const custom = String(higherCourtOther || "").trim();
    if (!custom) throw new Error("Enter the higher court or agency name.");
    return custom;
  }
  if (!selected) throw new Error("Select the higher court or agency.");
  return selected;
}

export function defaultElevatedCaseTitle(sourceCaseTitle: string): string {
  const base = sourceCaseTitle.trim() || "Case";
  if (/^appeal\b/i.test(base)) return base;
  return `Appeal — ${base}`;
}

export function resolveElevatedCaseNumber(caseNumber?: string): {
  caseNumber: string;
  awaitingCaseNumber: boolean;
} {
  const trimmed = String(caseNumber || "").trim();
  if (!trimmed || /^pending\b/i.test(trimmed)) {
    return { caseNumber: ELEVATION_PENDING_CASE_NUMBER, awaitingCaseNumber: true };
  }
  return { caseNumber: trimmed, awaitingCaseNumber: false };
}

export function buildElevationIntakePathDetails(details: MatterElevationDetails): string {
  return JSON.stringify({ elevation: details });
}

export function parseElevationIntakePathDetails(
  raw: string | null | undefined
): MatterElevationDetails | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { elevation?: Partial<MatterElevationDetails> };
    const elevation = parsed?.elevation;
    if (!elevation?.fromCode || !elevation.higherCourt) return null;
    return {
      fromCode: String(elevation.fromCode),
      fromCaseNumber: String(elevation.fromCaseNumber || ""),
      fromCourtPending: String(elevation.fromCourtPending || ""),
      fromCaseTitle: String(elevation.fromCaseTitle || ""),
      higherCourt: String(elevation.higherCourt),
      awaitingCaseNumber: Boolean(elevation.awaitingCaseNumber),
      elevatedAt: String(elevation.elevatedAt || "")
    };
  } catch {
    return null;
  }
}

export function canElevateMatterToHigherCourt(
  client: Pick<ClientDetail, "matterType" | "caseTitle" | "retainerBalance" | "status" | "accountStatus">
): boolean {
  const status = String(client.status || client.accountStatus || "").trim().toLowerCase();
  if (status === "closed" || status === "inactive") return false;
  const matterType = resolveClientMatterType({
    matterType: client.matterType,
    caseTitle: client.caseTitle,
    retainerBalance: client.retainerBalance
  });
  return matterType === "case";
}

export function appealAcceptanceFeeDescription(higherCourt: string): string {
  const court = higherCourt.trim() || "higher court";
  return `Acceptance fee — appeal to ${court} (${APPEAL_ACCEPTANCE_FEE_LEDGER_MARKER})`;
}

export function appealExpenseDepositDescription(higherCourt: string): string {
  const court = higherCourt.trim() || "higher court";
  return `Expense deposit — appeal to ${court} (${APPEAL_EXPENSE_DEPOSIT_LEDGER_MARKER})`;
}

export function buildAppealElevationFeeDrafts(input: {
  caseTitle: string;
  higherCourt: string;
  ledgerEntries: Array<{ category: string; description: string; charge: number }>;
}): { acceptance: ElevationFeeDraft | null; deposit: ElevationFeeDraft | null } {
  const higherCourt = input.higherCourt.trim() || "higher court";
  const hasAcceptance = input.ledgerEntries.some(
    (row) =>
      row.charge > 0 &&
      (row.description.includes(APPEAL_ACCEPTANCE_FEE_LEDGER_MARKER) ||
        (/acceptance/i.test(row.category) && /appeal/i.test(row.description)))
  );
  const hasDeposit = input.ledgerEntries.some(
    (row) =>
      row.charge > 0 &&
      (row.description.includes(APPEAL_EXPENSE_DEPOSIT_LEDGER_MARKER) ||
        (/deposit/i.test(row.description) && /appeal/i.test(row.description)))
  );

  const acceptanceAmount = resolveContractAcceptanceFee(input.caseTitle, higherCourt).acceptanceFee;

  return {
    acceptance: hasAcceptance
      ? null
      : {
          category: "Acceptance Fee",
          description: appealAcceptanceFeeDescription(higherCourt),
          amount: String(acceptanceAmount)
        },
    deposit: hasDeposit
      ? null
      : {
          category: "Other",
          description: appealExpenseDepositDescription(higherCourt),
          amount: String(APPEAL_EXPENSE_DEPOSIT_DEFAULT)
        }
  };
}

export function buildElevateCourtCreatePayload(input: {
  source: ClientDetail;
  nextCode: string;
  homeCode: string;
  higherCourt: string;
  caseTitle: string;
  caseNumber: string;
  awaitingCaseNumber: boolean;
}): NewClientPayload {
  const { source, nextCode, homeCode, higherCourt, caseTitle, caseNumber, awaitingCaseNumber } = input;
  const elevatedAt = new Date().toISOString().slice(0, 10);

  return {
    clientCode: nextCode,
    clientName: source.name,
    caseTitle,
    caseNumber,
    courtPending: higherCourt,
    caseRole: source.caseRole || "",
    contactEmail: source.email || "",
    contactPhone: source.phone || "",
    clientAddress: source.address || "",
    preferredGreeting: source.preferredGreeting || "",
    clientStatus: "Active",
    birthday: source.birthday || "",
    psychologistName: source.psychologistName || "",
    psychologistPhone: source.psychologistPhone || "",
    psychologistAddress: source.psychologistAddress || "",
    matterType: "case",
    caseType: source.caseType || "",
    caseTypeOther: source.caseTypeOther || "",
    prevBalance: "0"
  } as NewClientPayload;
}

export function planElevateCourtCodes(
  source: Pick<ClientDetail, "code" | "parentClientCode">,
  familyMembers: MatterFamilyMember[]
): { homeCode: string; nextCode: string } {
  const homeCode = resolveMatterFamilyRoot(source);
  const nextCode = nextSequentialMatterCode(homeCode, familyMembers);
  return { homeCode, nextCode };
}


export type MatterElevatedToDetails = {
  code: string;
  higherCourt: string;
  caseTitle: string;
  elevatedAt: string;
};

export function parseElevatedToIntakePathDetails(
  raw: string | null | undefined
): MatterElevatedToDetails | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { elevatedTo?: Partial<MatterElevatedToDetails> };
    const elevatedTo = parsed?.elevatedTo;
    if (!elevatedTo?.code || !elevatedTo.higherCourt) return null;
    return {
      code: String(elevatedTo.code).trim().toUpperCase(),
      higherCourt: String(elevatedTo.higherCourt || ""),
      caseTitle: String(elevatedTo.caseTitle || ""),
      elevatedAt: String(elevatedTo.elevatedAt || "")
    };
  } catch {
    return null;
  }
}

export function mergeElevatedToIntoIntakePathDetails(
  existing: string | null | undefined,
  elevatedTo: MatterElevatedToDetails
): string {
  let base: Record<string, unknown> = {};
  const text = String(existing || "").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, elevatedTo });
}

export function clearAwaitingCaseNumberInIntakePathDetails(
  existing: string | null | undefined
): string | null {
  const elevation = parseElevationIntakePathDetails(existing);
  if (!elevation?.awaitingCaseNumber) return null;
  const text = String(existing || "").trim();
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  return JSON.stringify({
    ...base,
    elevation: { ...elevation, awaitingCaseNumber: false }
  });
}

export function isElevationPendingDocket(input: {
  caseNumber?: string | null;
  intakePathDetails?: string | null;
}): boolean {
  const elevation = parseElevationIntakePathDetails(input.intakePathDetails);
  if (elevation?.awaitingCaseNumber) return true;
  const caseNumber = String(input.caseNumber || "").trim();
  return Boolean(caseNumber && /^pending\b/i.test(caseNumber));
}

export function findElevatedSiblingFromSource(
  members: Array<Pick<MatterFamilyMember, "code" | "intakePathDetails" | "parentClientCode" | "matterStage" | "caseTitle" | "courtPending">>,
  sourceCode: string
): { code: string; higherCourt: string; caseTitle: string } | null {
  const source = sourceCode.trim().toUpperCase();
  for (const member of members) {
    const elevation = parseElevationIntakePathDetails(member.intakePathDetails);
    if (elevation?.fromCode.trim().toUpperCase() === source) {
      return {
        code: member.code.trim().toUpperCase(),
        higherCourt: elevation.higherCourt || String(member.courtPending || ""),
        caseTitle: member.caseTitle || elevation.fromCaseTitle || ""
      };
    }
  }
  return null;
}

export function matterAlreadyElevated(
  client: Pick<ClientDetail, "code" | "intakePathDetails">,
  familyMembers?: Array<Pick<MatterFamilyMember, "code" | "intakePathDetails" | "parentClientCode" | "matterStage" | "caseTitle" | "courtPending">>
): { elevatedCode: string; higherCourt: string } | null {
  const fromSelf = parseElevatedToIntakePathDetails(client.intakePathDetails);
  if (fromSelf) return { elevatedCode: fromSelf.code, higherCourt: fromSelf.higherCourt };
  if (familyMembers?.length) {
    const sibling = findElevatedSiblingFromSource(familyMembers, client.code);
    if (sibling) return { elevatedCode: sibling.code, higherCourt: sibling.higherCourt };
  }
  return null;
}

export function shortCourtForumLabel(courtPending: string | null | undefined): string {
  const raw = String(courtPending || "").trim();
  if (!raw) return "";
  if (/supreme\s*court|\bsc\b/i.test(raw)) return "SC";
  if (/court\s*of\s*appeals|\bca\b/i.test(raw)) return "CA";
  if (/sandiganbayan/i.test(raw)) return "Sandiganbayan";
  if (/tax\s*appeals|\bcta\b/i.test(raw)) return "CTA";
  if (/\bnlrc\b/i.test(raw)) return "NLRC";
  if (/\brtc\b/i.test(raw)) return "RTC";
  if (/\bmtc\b|mtcc|mctc/i.test(raw)) return "MTC";
  return raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
}

export function matterFamilyForumRoleLabel(member: Pick<MatterFamilyMember, "matterStage" | "courtPending" | "intakePathDetails" | "caseTitle">): string {
  const elevation = parseElevationIntakePathDetails(member.intakePathDetails);
  const forum = shortCourtForumLabel(member.courtPending || elevation?.higherCourt);
  if (elevation || /^appeal$/i.test(String(member.matterStage || "")) || /^appeal\b/i.test(String(member.caseTitle || ""))) {
    return forum ? `Appeal · ${forum}` : "Appeal";
  }
  return forum ? `Trial · ${forum}` : "Trial";
}

export function buildAppealElevationSeedTasks(input: {
  clientCase: string;
  assignee: string;
  higherCourt: string;
  fromCode: string;
  awaitingCaseNumber: boolean;
}): import("@/lib/office-tasks/sheets/tasks").TaskFormInput[] {
  const court = input.higherCourt.trim() || "higher court";
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const dueDate = due.toISOString().slice(0, 10);
  const tasks: import("@/lib/office-tasks/sheets/tasks").TaskFormInput[] = [
    {
      clientCase: input.clientCase,
      assignedTo: input.assignee,
      dueDate,
      priority: "High",
      taskType: "Administrative",
      description: `Send appeal engagement supplement — ${court} (continues ${input.fromCode})`,
      nextAction: "Draft/send the appeal fee supplement linking this matter to the trial file.",
      remarks: "APPEAL_SETUP:engagement",
      status: "In Progress",
      reminderDays: 1,
      calendarSync: false
    },
    {
      clientCase: input.clientCase,
      assignedTo: input.assignee,
      dueDate,
      priority: "High",
      taskType: "Administrative",
      description: `Post appeal acceptance fee & expense deposit — ${court}`,
      nextAction: "Use Billing drafts on this elevated matter (not the trial ledger).",
      remarks: "APPEAL_SETUP:fees",
      status: "In Progress",
      reminderDays: 1,
      calendarSync: false
    }
  ];
  if (input.awaitingCaseNumber) {
    tasks.push({
      clientCase: input.clientCase,
      assignedTo: input.assignee,
      dueDate,
      priority: "Medium",
      taskType: "Court Follow-up",
      description: `Update appellate docket number when issued — ${court}`,
      nextAction: "Replace pending case number on this matter once the higher court issues a docket.",
      remarks: "APPEAL_SETUP:docket",
      status: "In Progress",
      reminderDays: 2,
      calendarSync: false
    });
  }
  return tasks;
}

/** Re-export for callers that already have the full client list. */
export function familyMembersForElevate(
  clients: Parameters<typeof listMatterFamilyMembers>[0],
  code: string
): MatterFamilyMember[] {
  return listMatterFamilyMembers(clients, code);
}
