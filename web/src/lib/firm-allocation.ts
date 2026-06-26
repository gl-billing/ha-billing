export const ALLOCATION_SETTING_KEYS = {
  expensesPct: "Income Split Expenses Pct",
  savingsPct: "Income Split Savings Pct",
  travelPct: "Income Split Travel Pct",
  emergencyPct: "Income Split Emergency Pct",
  closedMonths: "Income Split Closed Months",
  bucketOpeningExpenses: "Income Split Bucket Opening Expenses",
  bucketOpeningSavings: "Income Split Bucket Opening Savings",
  bucketOpeningTravel: "Income Split Bucket Opening Travel",
  bucketOpeningEmergency: "Income Split Bucket Opening Emergency",
  bucketBalanceExpenses: "Income Split Bucket Balance Expenses",
  bucketBalanceSavings: "Income Split Bucket Balance Savings",
  bucketBalanceTravel: "Income Split Bucket Balance Travel",
  bucketBalanceEmergency: "Income Split Bucket Balance Emergency",
  bucketAdjustments: "Income Split Bucket Adjustments"
} as const;

export type AllocationBucketKey = "expenses" | "savings" | "travel" | "emergency";

export const ALLOCATION_BUCKET_ORDER: AllocationBucketKey[] = [
  "expenses",
  "savings",
  "travel",
  "emergency"
];

export const ALLOCATION_BUCKET_LABELS: Record<AllocationBucketKey, string> = {
  expenses: "Expenses",
  savings: "Investment / savings",
  travel: "Travel & wants",
  emergency: "Emergency"
};

export const DEFAULT_ALLOCATION_PERCENTS: Record<AllocationBucketKey, number> = {
  expenses: 60,
  savings: 10,
  travel: 20,
  emergency: 10
};

export const UNASSIGNED_ATTORNEY_LABEL = "Unassigned";

/** Ledger payment categories counted toward the office 60/10/20/10 split. */
export const OFFICE_SPLIT_LEDGER_CATEGORIES = [
  "Acceptance Fee",
  "Professional Fee",
  "Notarial Fee"
] as const;

export type AllocationSettings = {
  percents: Record<AllocationBucketKey, number>;
  percentTotal: number;
  percentValid: boolean;
};

export type AllocationIncomeLine = {
  id: string;
  date: string;
  source: "payment" | "notarization";
  clientCode: string;
  clientName: string;
  label: string;
  amount: number;
};

export type AppearanceFeeAttributionLine = {
  id: string;
  date: string;
  clientCode: string;
  clientName: string;
  assignedAttorney: string;
  label: string;
  amount: number;
};

export type AppearanceFeeAttorneySummary = {
  assignedAttorney: string;
  total: number;
  lines: AppearanceFeeAttributionLine[];
};

export type UnclassifiedIncomeLine = {
  id: string;
  sheetRow: number;
  date: string;
  clientCode: string;
  clientName: string;
  assignedAttorney: string;
  category: string;
  label: string;
  amount: number;
  reason: string;
};

export type IncomeSourceBreakdown = {
  acceptance: number;
  professional: number;
  notarial: number;
};

export type BucketBalances = {
  opening: Record<AllocationBucketKey, number>;
  current: Record<AllocationBucketKey, number>;
  allocatedThisMonth: Record<AllocationBucketKey, number>;
};

export type BucketAdjustment = {
  id: string;
  date: string;
  bucket: AllocationBucketKey;
  amount: number;
  note: string;
};

export type RollingMonthSummary = {
  year: number;
  month: number;
  monthLabel: string;
  shortLabel: string;
  totalIncome: number;
  monthClosed: boolean;
};

export type MonthCloseChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  message: string;
};

export type MonthlyAllocationReport = {
  year: number;
  month: number;
  monthLabel: string;
  settings: AllocationSettings;
  lines: AllocationIncomeLine[];
  totalIncome: number;
  splits: Record<AllocationBucketKey, number>;
  sourceBreakdown: IncomeSourceBreakdown;
  appearanceFees: AppearanceFeeAttributionLine[];
  appearanceFeeByAttorney: AppearanceFeeAttorneySummary[];
  totalAppearanceFees: number;
  unclassifiedIncome: UnclassifiedIncomeLine[];
  totalUnclassifiedIncome: number;
  monthClosed: boolean;
  closedAt?: string;
  priorMonthIncome?: number;
  incomeChangePct?: number;
  priorYearSameMonthIncome?: number;
  priorYearChangePct?: number;
  rollingMonths: RollingMonthSummary[];
  closeChecklist: MonthCloseChecklistItem[];
  bucketBalances: BucketBalances;
  bucketAdjustments: BucketAdjustment[];
};

function parsePercent(value: string | undefined, fallback: number): number {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

export function readAllocationSettings(settings: Map<string, string>): AllocationSettings {
  const percents: Record<AllocationBucketKey, number> = {
    expenses: parsePercent(settings.get(ALLOCATION_SETTING_KEYS.expensesPct), DEFAULT_ALLOCATION_PERCENTS.expenses),
    savings: parsePercent(settings.get(ALLOCATION_SETTING_KEYS.savingsPct), DEFAULT_ALLOCATION_PERCENTS.savings),
    travel: parsePercent(settings.get(ALLOCATION_SETTING_KEYS.travelPct), DEFAULT_ALLOCATION_PERCENTS.travel),
    emergency: parsePercent(
      settings.get(ALLOCATION_SETTING_KEYS.emergencyPct),
      DEFAULT_ALLOCATION_PERCENTS.emergency
    )
  };
  const percentTotal = ALLOCATION_BUCKET_ORDER.reduce((sum, key) => sum + percents[key], 0);
  return {
    percents,
    percentTotal: Math.round(percentTotal * 100) / 100,
    percentValid: Math.abs(percentTotal - 100) < 0.01
  };
}

export function normalizeAllocationSettingsInput(input: {
  expensesPct?: number;
  savingsPct?: number;
  travelPct?: number;
  emergencyPct?: number;
}): Record<AllocationBucketKey, number> {
  const percents: Record<AllocationBucketKey, number> = {
    expenses: parsePercent(String(input.expensesPct ?? ""), DEFAULT_ALLOCATION_PERCENTS.expenses),
    savings: parsePercent(String(input.savingsPct ?? ""), DEFAULT_ALLOCATION_PERCENTS.savings),
    travel: parsePercent(String(input.travelPct ?? ""), DEFAULT_ALLOCATION_PERCENTS.travel),
    emergency: parsePercent(String(input.emergencyPct ?? ""), DEFAULT_ALLOCATION_PERCENTS.emergency)
  };
  const total = ALLOCATION_BUCKET_ORDER.reduce((sum, key) => sum + percents[key], 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Allocation percentages must add up to 100% (currently ${total}%).`);
  }
  return percents;
}

/** Ledger payment rows tagged as appearance fees — attributed to assigned attorney, not office split. */
export function isAppearanceFeePayment(category: string, description: string, details: string): boolean {
  const haystack = `${category} ${description} ${details}`.toLowerCase();
  return haystack.includes("appearance fee");
}

/** Acceptance, professional, and notarial ledger payments — office split only. Notarizations tab is added separately. */
export function isOfficeSplitPayment(category: string, description: string, details: string): boolean {
  if (isAppearanceFeePayment(category, description, details)) return false;

  const normalizedCategory = category.trim().toLowerCase();
  if (
    normalizedCategory === "acceptance fee" ||
    normalizedCategory === "professional fee" ||
    normalizedCategory === "notarial fee"
  ) {
    return true;
  }

  const haystack = `${category} ${description} ${details}`.toLowerCase();
  return (
    haystack.includes("acceptance fee") ||
    haystack.includes("professional fee") ||
    haystack.includes("notarial fee") ||
    haystack.includes("notarization")
  );
}

export function isExplicitNonIncomePayment(category: string, description: string, details: string): boolean {
  const normalizedCategory = category.trim().toLowerCase();
  const haystack = `${category} ${description} ${details}`.toLowerCase();
  return (
    normalizedCategory === "transportation" ||
    normalizedCategory === "reimbursement" ||
    haystack.includes("reimbursement") ||
    haystack.includes("transportation") ||
    haystack.includes("bus fare") ||
    haystack.includes(" taxi") ||
    haystack.includes("travel advance")
  );
}

/** Payments that look like firm income but are not yet in office split or appearance attribution. */
export function isUnclassifiedIncomePayment(category: string, description: string, details: string): boolean {
  if (isOfficeSplitPayment(category, description, details)) return false;
  if (isAppearanceFeePayment(category, description, details)) return false;
  if (isExplicitNonIncomePayment(category, description, details)) return false;

  const normalizedCategory = category.trim().toLowerCase();
  const normalizedDescription = description.trim().toLowerCase();

  if (normalizedCategory === "payment" && (normalizedDescription === "payment received" || !normalizedDescription)) {
    return true;
  }
  if (normalizedCategory === "filing fee") return true;
  if (normalizedCategory === "other") return true;
  if (!normalizedCategory) return true;
  return false;
}

export function unclassifiedIncomeReason(category: string, description: string): string {
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedDescription = description.trim().toLowerCase();
  if (normalizedCategory === "payment" && (normalizedDescription === "payment received" || !normalizedDescription)) {
    return "Generic payment label";
  }
  if (normalizedCategory === "filing fee") return "Filing fee — not in office split";
  if (normalizedCategory === "other") return "Other income — review classification";
  return "Needs income type";
}

export function summarizeOfficeIncomeSources(lines: AllocationIncomeLine[]): IncomeSourceBreakdown {
  const breakdown: IncomeSourceBreakdown = { acceptance: 0, professional: 0, notarial: 0 };

  lines.forEach((line) => {
    const text = `${line.label} ${line.source}`.toLowerCase();
    if (line.source === "notarization" || text.includes("notarial") || text.includes("notarization")) {
      breakdown.notarial += line.amount;
      return;
    }
    if (text.includes("acceptance")) {
      breakdown.acceptance += line.amount;
      return;
    }
    if (text.includes("professional")) {
      breakdown.professional += line.amount;
      return;
    }
    breakdown.professional += line.amount;
  });

  breakdown.acceptance = Math.round(breakdown.acceptance * 100) / 100;
  breakdown.professional = Math.round(breakdown.professional * 100) / 100;
  breakdown.notarial = Math.round(breakdown.notarial * 100) / 100;
  return breakdown;
}

export function monthCloseToken(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthClosedAtKey(year: number, month: number): string {
  return `Income Split Closed At ${monthCloseToken(year, month)}`;
}

export function readClosedMonths(settings: Map<string, string>): Set<string> {
  const raw = String(settings.get(ALLOCATION_SETTING_KEYS.closedMonths) ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function parseMoneySetting(value: string | undefined): number {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function parseMoneySettingOptional(value: string | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return parseMoneySetting(text);
}

export function readBucketOpeningBalances(settings: Map<string, string>): Record<AllocationBucketKey, number> {
  return {
    expenses: parseMoneySetting(settings.get(ALLOCATION_SETTING_KEYS.bucketOpeningExpenses)),
    savings: parseMoneySetting(settings.get(ALLOCATION_SETTING_KEYS.bucketOpeningSavings)),
    travel: parseMoneySetting(settings.get(ALLOCATION_SETTING_KEYS.bucketOpeningTravel)),
    emergency: parseMoneySetting(settings.get(ALLOCATION_SETTING_KEYS.bucketOpeningEmergency))
  };
}

export function readBucketCurrentBalances(settings: Map<string, string>): Record<AllocationBucketKey, number> {
  const opening = readBucketOpeningBalances(settings);
  return {
    expenses:
      parseMoneySettingOptional(settings.get(ALLOCATION_SETTING_KEYS.bucketBalanceExpenses)) ?? opening.expenses,
    savings:
      parseMoneySettingOptional(settings.get(ALLOCATION_SETTING_KEYS.bucketBalanceSavings)) ?? opening.savings,
    travel:
      parseMoneySettingOptional(settings.get(ALLOCATION_SETTING_KEYS.bucketBalanceTravel)) ?? opening.travel,
    emergency:
      parseMoneySettingOptional(settings.get(ALLOCATION_SETTING_KEYS.bucketBalanceEmergency)) ?? opening.emergency
  };
}

export function readBucketAdjustments(settings: Map<string, string>): BucketAdjustment[] {
  const raw = String(settings.get(ALLOCATION_SETTING_KEYS.bucketAdjustments) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BucketAdjustment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function computeIncomeChangePct(current: number, prior?: number): number | undefined {
  if (prior === undefined || prior <= 0) return undefined;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export function buildBucketBalances(
  settings: Map<string, string>,
  allocatedThisMonth: Record<AllocationBucketKey, number>
): BucketBalances {
  return {
    opening: readBucketOpeningBalances(settings),
    current: readBucketCurrentBalances(settings),
    allocatedThisMonth
  };
}

export function formatMonthlyStatementText(report: MonthlyAllocationReport): string {
  const lines = [
    `Hernandez & Associates — Office income statement`,
    `${report.monthLabel}`,
    "",
    `Office income total: ₱${report.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ""
  ];

  ALLOCATION_BUCKET_ORDER.forEach((key) => {
    lines.push(
      `${ALLOCATION_BUCKET_LABELS[key]} (${report.settings.percents[key]}%): ₱${report.splits[key].toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  });

  lines.push("", `Appearance fees (by attorney): ₱${report.totalAppearanceFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  report.appearanceFeeByAttorney.forEach((group) => {
    lines.push(`  ${group.assignedAttorney}: ₱${group.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  });

  if (report.unclassifiedIncome.length) {
    lines.push("", `Needs review: ₱${report.totalUnclassifiedIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  }

  if (report.monthClosed) {
    lines.push("", `Status: Month closed${report.closedAt ? ` · ${report.closedAt}` : ""}`);
  }

  return lines.join("\n");
}

export function summarizeAppearanceFeesByAttorney(
  lines: AppearanceFeeAttributionLine[]
): AppearanceFeeAttorneySummary[] {
  const map = new Map<string, AppearanceFeeAttributionLine[]>();
  lines.forEach((line) => {
    const key = line.assignedAttorney.trim() || UNASSIGNED_ATTORNEY_LABEL;
    const bucket = map.get(key) || [];
    bucket.push(line);
    map.set(key, bucket);
  });

  return [...map.entries()]
    .map(([assignedAttorney, attorneyLines]) => ({
      assignedAttorney,
      total: Math.round(attorneyLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
      lines: attorneyLines
    }))
    .sort((a, b) => b.total - a.total || a.assignedAttorney.localeCompare(b.assignedAttorney));
}

export function computeAllocationSplits(
  totalIncome: number,
  percents: Record<AllocationBucketKey, number>
): Record<AllocationBucketKey, number> {
  const splits = {} as Record<AllocationBucketKey, number>;
  let assigned = 0;
  ALLOCATION_BUCKET_ORDER.forEach((key, index) => {
    if (index === ALLOCATION_BUCKET_ORDER.length - 1) {
      splits[key] = Math.round((totalIncome - assigned) * 100) / 100;
      return;
    }
    const amount = Math.round(totalIncome * (percents[key] / 100) * 100) / 100;
    splits[key] = amount;
    assigned += amount;
  });
  return splits;
}

export function shiftAllocationMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function parseLedgerMonthToken(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return monthCloseToken(d.getFullYear(), d.getMonth() + 1);
}

export function isLedgerDateInClosedMonth(value: unknown, settings: Map<string, string>): boolean {
  const token = parseLedgerMonthToken(value);
  if (!token) return false;
  return readClosedMonths(settings).has(token);
}

export function buildMonthCloseChecklist(report: MonthlyAllocationReport): MonthCloseChecklistItem[] {
  const items: MonthCloseChecklistItem[] = [];

  items.push({
    id: "policy-valid",
    label: "Allocation policy",
    status: report.settings.percentValid ? "ok" : "error",
    message: report.settings.percentValid
      ? "Percentages total 100%."
      : `Policy totals ${report.settings.percentTotal}% — fix before closing.`
  });

  items.push({
    id: "unclassified",
    label: "Needs review",
    status: report.totalUnclassifiedIncome > 0 ? "warn" : "ok",
    message:
      report.totalUnclassifiedIncome > 0
        ? `${report.unclassifiedIncome.length} payment(s) · ${report.totalUnclassifiedIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })} unclassified.`
        : "All ledger payments are classified."
  });

  const unassigned = report.appearanceFeeByAttorney.find(
    (group) => group.assignedAttorney === UNASSIGNED_ATTORNEY_LABEL
  );
  items.push({
    id: "appearance-attribution",
    label: "Appearance fees",
    status: unassigned && unassigned.total > 0 ? "warn" : "ok",
    message:
      unassigned && unassigned.total > 0
        ? `${unassigned.lines.length} appearance fee(s) have no assigned attorney.`
        : "Appearance fees are attributed."
  });

  items.push({
    id: "office-income",
    label: "Office income",
    status: report.totalIncome > 0 ? "ok" : "warn",
    message:
      report.totalIncome > 0
        ? `${report.lines.length} qualifying receipt(s) · ${report.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
        : "No qualifying office income this month."
  });

  return items;
}

export function monthCloseHasBlockers(checklist: MonthCloseChecklistItem[]): boolean {
  return checklist.some((item) => item.status === "error");
}

export function monthCloseHasWarnings(checklist: MonthCloseChecklistItem[]): boolean {
  return checklist.some((item) => item.status === "warn");
}

export function formatAppearanceFeeStatementText(
  group: AppearanceFeeAttorneySummary,
  monthLabel: string
): string {
  const lines = [
    `Hernandez & Associates — Appearance fees`,
    `${group.assignedAttorney} · ${monthLabel}`,
    "",
    `Total: ₱${group.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ""
  ];
  group.lines.forEach((line) => {
    lines.push(
      `${line.date} · ${line.clientCode}${line.clientName ? ` · ${line.clientName}` : ""} · ₱${line.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    );
  });
  return lines.join("\n");
}
