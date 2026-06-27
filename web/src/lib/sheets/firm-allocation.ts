import {
  ALLOCATION_BUCKET_ORDER,
  ALLOCATION_SETTING_KEYS,
  buildBucketBalances,
  computeAcceptanceFeeShares,
  computeAllocationSplits,
  computeIncomeChangePct,
  computePleadingFeeShares,
  isAppearanceFeePayment,
  isAcceptanceFeePayment,
  isOfficeSplitPayment,
  isPleadingFeePayment,
  isUnclassifiedIncomePayment,
  monthCloseHasBlockers,
  monthCloseHasWarnings,
  monthCloseToken,
  monthClosedAtKey,
  readAllocationSettings,
  readBucketAdjustments,
  readBucketCurrentBalances,
  readClosedMonths,
  shiftAllocationMonth,
  summarizeAcceptanceFeeSharing,
  summarizeAppearanceFeesByAttorney,
  summarizeOfficeIncomeSources,
  summarizePleadingFeeSharing,
  buildMonthCloseChecklist,
  unclassifiedIncomeReason,
  UNASSIGNED_ATTORNEY_LABEL,
  type AllocationBucketKey,
  type AllocationIncomeLine,
  type AllocationSettings,
  type AppearanceFeeAttributionLine,
  type AcceptanceFeeAttributionLine,
  type PleadingFeeAttributionLine,
  type BucketAdjustment,
  type MonthlyAllocationReport,
  type RollingMonthSummary,
  type UnclassifiedIncomeLine
} from "@/lib/firm-allocation";
import { resolveAcceptanceFeeAssociateFromClient } from "@/lib/assigned-lawyers";
import { GL } from "@/lib/gl-config";
import {
  parseAppearanceAttorneyFromLedgerDetails,
  parsePleadingDrafterFromLedgerDetails,
  parseSoleLawyerFromLedgerDetails
} from "@/lib/office-tasks/event-matter-billing-shared";
import {
  appendSheetValues,
  getSheetsClient,
  getSpreadsheetId,
  updateSheetValues
} from "@/lib/sheets/client";
import { getAllMasterRows } from "@/lib/sheets/master";
import { listNotarizations, NOTARIZATION_DELETED_STATUS } from "@/lib/sheets/notarizations";
import { invalidateSettingsCache, readSettingsMap, readSettingsRowIndex } from "@/lib/sheets/settings";
import { getSheetTitles } from "@/lib/sheets/sheet-meta";

type ClientLedgerMeta = {
  code: string;
  name: string;
  assignedAttorney: string;
  coAssignedAttorney: string;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function formatDateDisplay(value: unknown): string {
  if (!value) return "";
  const d = parseDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function clientsFromMaster(masterRows: unknown[][]): ClientLedgerMeta[] {
  return masterRows
    .filter((row) => row[0])
    .map((row) => ({
      code: String(row[0]),
      name: String(row[1] || ""),
      assignedAttorney: String(row[22] || "").trim() || UNASSIGNED_ATTORNEY_LABEL,
      coAssignedAttorney: String(row[35] || "").trim()
    }));
}

async function batchGetClientLedgerPayments(
  accessToken: string,
  clients: ClientLedgerMeta[],
  existingTabs: Set<string>
): Promise<Map<string, string[][]>> {
  const sheets = getSheetsClient(accessToken);
  const result = new Map<string, string[][]>();
  const eligible = clients.filter((c) => existingTabs.has(c.code));
  const chunkSize = 40;

  for (let i = 0; i < eligible.length; i += chunkSize) {
    const chunk = eligible.slice(i, i + chunkSize);
    const ranges = chunk.map(
      (c) => `'${c.code.replace(/'/g, "''")}'!A${GL.ledgerStartRow}:I`
    );

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: getSpreadsheetId(),
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });

    const valueRanges = response.data.valueRanges || [];
    chunk.forEach((client, idx) => {
      result.set(client.code, (valueRanges[idx]?.values as string[][]) || []);
    });
  }

  return result;
}

function collectUnclassifiedIncomeLines(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  year: number,
  month: number
): UnclassifiedIncomeLine[] {
  const lines: UnclassifiedIncomeLine[] = [];

  clients.forEach((client) => {
    const rows = ledgers.get(client.code) || [];
    rows.forEach((row, index) => {
      if (!row[0]) return;
      const type = String(row[1] || "").toLowerCase();
      if (type !== "payment") return;
      const amount = Number(row[5]) || 0;
      if (amount <= 0) return;
      if (!isInMonth(String(row[0]), year, month)) return;

      const category = String(row[2] || "");
      const description = String(row[3] || "");
      const details = String(row[8] || "");
      if (!isUnclassifiedIncomePayment(category, description, details)) return;

      const sheetRow = index + GL.ledgerStartRow;
      lines.push({
        id: `unclassified-${client.code}-${sheetRow}`,
        sheetRow,
        date: formatDateDisplay(row[0]),
        clientCode: client.code,
        clientName: client.name,
        assignedAttorney: client.assignedAttorney,
        category,
        label: description || category || "Payment",
        amount,
        reason: unclassifiedIncomeReason(category, description)
      });
    });
  });

  return lines.sort((a, b) => (parseDate(b.date)?.getTime() ?? 0) - (parseDate(a.date)?.getTime() ?? 0));
}

function collectOfficePaymentLines(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  year: number,
  month: number
): AllocationIncomeLine[] {
  const lines: AllocationIncomeLine[] = [];

  clients.forEach((client) => {
    const rows = ledgers.get(client.code) || [];
    rows.forEach((row, index) => {
      if (!row[0]) return;
      const type = String(row[1] || "").toLowerCase();
      if (type !== "payment") return;
      const amount = Number(row[5]) || 0;
      if (amount <= 0) return;
      if (!isInMonth(String(row[0]), year, month)) return;

      const category = String(row[2] || "");
      const description = String(row[3] || "");
      const details = String(row[8] || "");
      if (!isOfficeSplitPayment(category, description, details)) return;

      const sheetRow = index + GL.ledgerStartRow;
      lines.push({
        id: `payment-${client.code}-${sheetRow}`,
        date: formatDateDisplay(row[0]),
        source: "payment",
        clientCode: client.code,
        clientName: client.name,
        label: description || category || "Payment",
        amount
      });
    });
  });

  return lines;
}

function collectAppearanceFeeLines(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  year: number,
  month: number
): AppearanceFeeAttributionLine[] {
  const lines: AppearanceFeeAttributionLine[] = [];

  clients.forEach((client) => {
    const rows = ledgers.get(client.code) || [];
    rows.forEach((row, index) => {
      if (!row[0]) return;
      const type = String(row[1] || "").toLowerCase();
      if (type !== "payment") return;
      const amount = Number(row[5]) || 0;
      if (amount <= 0) return;
      if (!isInMonth(String(row[0]), year, month)) return;

      const category = String(row[2] || "");
      const description = String(row[3] || "");
      const details = String(row[8] || "");
      if (!isAppearanceFeePayment(category, description, details)) return;

      const sheetRow = index + GL.ledgerStartRow;
      lines.push({
        id: `appearance-${client.code}-${sheetRow}`,
        date: formatDateDisplay(row[0]),
        clientCode: client.code,
        clientName: client.name,
        assignedAttorney:
          parseAppearanceAttorneyFromLedgerDetails(details) || client.assignedAttorney,
        label: description || category || "Appearance fee",
        amount
      });
    });
  });

  return lines;
}

function collectAcceptanceFeeLines(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  year: number,
  month: number
): AcceptanceFeeAttributionLine[] {
  const lines: AcceptanceFeeAttributionLine[] = [];

  clients.forEach((client) => {
    const rows = ledgers.get(client.code) || [];
    rows.forEach((row, index) => {
      if (!row[0]) return;
      const type = String(row[1] || "").toLowerCase();
      if (type !== "payment") return;
      const amount = Number(row[5]) || 0;
      if (amount <= 0) return;
      if (!isInMonth(String(row[0]), year, month)) return;

      const category = String(row[2] || "");
      const description = String(row[3] || "");
      const details = String(row[8] || "");
      if (!isAcceptanceFeePayment(category, description, details)) return;

      const shares = computeAcceptanceFeeShares(amount);
      const sheetRow = index + GL.ledgerStartRow;
      lines.push({
        id: `acceptance-${client.code}-${sheetRow}`,
        date: formatDateDisplay(row[0]),
        clientCode: client.code,
        clientName: client.name,
        handlingAssociate: resolveAcceptanceFeeAssociateFromClient(
          client.assignedAttorney,
          client.coAssignedAttorney
        ),
        label: description || category || "Acceptance fee",
        amount,
        ...shares
      });
    });
  });

  return lines;
}

function collectPleadingFeeLines(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  year: number,
  month: number
): PleadingFeeAttributionLine[] {
  const lines: PleadingFeeAttributionLine[] = [];

  clients.forEach((client) => {
    const rows = ledgers.get(client.code) || [];
    rows.forEach((row, index) => {
      if (!row[0]) return;
      const type = String(row[1] || "").toLowerCase();
      if (type !== "payment") return;
      const amount = Number(row[5]) || 0;
      if (amount <= 0) return;
      if (!isInMonth(String(row[0]), year, month)) return;

      const category = String(row[2] || "");
      const description = String(row[3] || "");
      const details = String(row[8] || "");
      if (!isPleadingFeePayment(category, description, details)) return;

      const soleLawyerOnMatter =
        parseSoleLawyerFromLedgerDetails(details) ||
        (!client.coAssignedAttorney.trim() && Boolean(client.assignedAttorney.trim()));
      const shares = computePleadingFeeShares(amount, { soleLawyerOnMatter });
      const sheetRow = index + GL.ledgerStartRow;
      lines.push({
        id: `pleading-${client.code}-${sheetRow}`,
        date: formatDateDisplay(row[0]),
        clientCode: client.code,
        clientName: client.name,
        drafter: parsePleadingDrafterFromLedgerDetails(details) || client.assignedAttorney,
        label: description || category || "Pleading fee",
        amount,
        soleLawyerOnMatter,
        ...shares
      });
    });
  });

  return lines;
}

function collectNotarizationLines(
  year: number,
  month: number,
  entries: Awaited<ReturnType<typeof listNotarizations>>
): AllocationIncomeLine[] {
  return entries
    .filter(
      (entry) =>
        entry.status !== NOTARIZATION_DELETED_STATUS &&
        entry.amount > 0 &&
        isInMonth(entry.date, year, month)
    )
    .map((entry) => ({
      id: `notarization-${entry.receiptNo}`,
      date: formatDateDisplay(entry.date),
      source: "notarization" as const,
      clientCode: "NOTARIAL",
      clientName: entry.name,
      label: `${entry.documentType || "Notarization"} · ${entry.receiptNo}`,
      amount: entry.amount
    }));
}

export async function getAllocationSettings(accessToken: string): Promise<AllocationSettings> {
  const settings = await readSettingsMap(accessToken);
  return readAllocationSettings(settings);
}

async function upsertSettingValue(
  accessToken: string,
  key: string,
  value: string,
  rowIndex: Map<string, number>
): Promise<void> {
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(key);
  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[value]]);
    return;
  }
  await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[key, value]]);
}

export async function saveAllocationSettings(
  accessToken: string,
  percents: Record<(typeof ALLOCATION_BUCKET_ORDER)[number], number>
): Promise<AllocationSettings> {
  const rowIndex = await readSettingsRowIndex(accessToken);

  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.expensesPct,
    String(percents.expenses),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.savingsPct,
    String(percents.savings),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.travelPct,
    String(percents.travel),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.emergencyPct,
    String(percents.emergency),
    rowIndex
  );

  invalidateSettingsCache(accessToken);
  return getAllocationSettings(accessToken);
}

export async function saveBucketOpeningBalances(
  accessToken: string,
  opening: Record<AllocationBucketKey, number>
): Promise<void> {
  const rowIndex = await readSettingsRowIndex(accessToken);

  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.bucketOpeningExpenses,
    String(opening.expenses),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.bucketOpeningSavings,
    String(opening.savings),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.bucketOpeningTravel,
    String(opening.travel),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.bucketOpeningEmergency,
    String(opening.emergency),
    rowIndex
  );

  invalidateSettingsCache(accessToken);
}

export async function closeAllocationMonth(
  accessToken: string,
  year: number,
  month: number,
  options?: { force?: boolean }
): Promise<MonthlyAllocationReport> {
  const report = await getMonthlyAllocationReport(accessToken, year, month);
  if (report.monthClosed) {
    throw new Error(`${report.monthLabel} is already marked closed.`);
  }
  if (monthCloseHasBlockers(report.closeChecklist)) {
    throw new Error("Fix allocation policy (must total 100%) before closing this month.");
  }
  if (!options?.force && monthCloseHasWarnings(report.closeChecklist)) {
    throw new Error(
      "Resolve Needs review items and appearance attribution warnings before closing, or close anyway from the checklist."
    );
  }

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const token = monthCloseToken(year, month);
  const closed = readClosedMonths(settingsMap);
  closed.add(token);

  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.closedMonths,
    [...closed].sort().join(","),
    rowIndex
  );
  await upsertSettingValue(
    accessToken,
    monthClosedAtKey(year, month),
    new Date().toISOString().slice(0, 10),
    rowIndex
  );

  const current = report.bucketBalances.current;
  for (const key of ALLOCATION_BUCKET_ORDER) {
    const balanceKey =
      key === "expenses"
        ? ALLOCATION_SETTING_KEYS.bucketBalanceExpenses
        : key === "savings"
          ? ALLOCATION_SETTING_KEYS.bucketBalanceSavings
          : key === "travel"
            ? ALLOCATION_SETTING_KEYS.bucketBalanceTravel
            : ALLOCATION_SETTING_KEYS.bucketBalanceEmergency;
    const next = Math.round((current[key] + report.splits[key]) * 100) / 100;
    await upsertSettingValue(accessToken, balanceKey, String(next), rowIndex);
  }

  invalidateSettingsCache(accessToken);
  return getMonthlyAllocationReport(accessToken, year, month);
}

function monthShortLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function sumMonthOfficeIncome(
  clients: ClientLedgerMeta[],
  ledgers: Map<string, string[][]>,
  notarizations: Awaited<ReturnType<typeof listNotarizations>>,
  year: number,
  month: number
): number {
  const paymentLines = collectOfficePaymentLines(clients, ledgers, year, month);
  const notarizationLines = collectNotarizationLines(year, month, notarizations);
  const acceptanceFirmShare = collectAcceptanceFeeLines(clients, ledgers, year, month).reduce(
    (sum, line) => sum + line.firmShare,
    0
  );
  const pleadingFirmShare = collectPleadingFeeLines(clients, ledgers, year, month).reduce(
    (sum, line) => sum + line.firmShare,
    0
  );
  return (
    Math.round(
      ([...paymentLines, ...notarizationLines].reduce((sum, line) => sum + line.amount, 0) +
        acceptanceFirmShare +
        pleadingFirmShare) *
        100
    ) / 100
  );
}

export async function recordBucketAdjustment(
  accessToken: string,
  input: { bucket: AllocationBucketKey; amount: number; note: string }
): Promise<{ adjustments: BucketAdjustment[]; balances: ReturnType<typeof buildBucketBalances> }> {
  const note = input.note.trim();
  if (!note) throw new Error("Enter a note for this adjustment.");
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!amount) throw new Error("Enter a non-zero amount (negative for withdrawal).");

  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const adjustments = readBucketAdjustments(settingsMap);
  const entry: BucketAdjustment = {
    id: `adj-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    bucket: input.bucket,
    amount,
    note
  };

  adjustments.push(entry);
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.bucketAdjustments,
    JSON.stringify(adjustments),
    rowIndex
  );

  const balanceKey =
    input.bucket === "expenses"
      ? ALLOCATION_SETTING_KEYS.bucketBalanceExpenses
      : input.bucket === "savings"
        ? ALLOCATION_SETTING_KEYS.bucketBalanceSavings
        : input.bucket === "travel"
          ? ALLOCATION_SETTING_KEYS.bucketBalanceTravel
          : ALLOCATION_SETTING_KEYS.bucketBalanceEmergency;

  const current = readBucketCurrentBalances(settingsMap)[input.bucket];
  const next = Math.round((current + amount) * 100) / 100;
  await upsertSettingValue(accessToken, balanceKey, String(next), rowIndex);

  invalidateSettingsCache(accessToken);
  const fresh = await readSettingsMap(accessToken);
  const zeroSplits = {
    expenses: 0,
    savings: 0,
    travel: 0,
    emergency: 0
  } as Record<AllocationBucketKey, number>;

  return {
    adjustments: readBucketAdjustments(fresh),
    balances: buildBucketBalances(fresh, zeroSplits)
  };
}

export async function reopenAllocationMonth(
  accessToken: string,
  year: number,
  month: number
): Promise<MonthlyAllocationReport> {
  const settingsMap = await readSettingsMap(accessToken);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const token = monthCloseToken(year, month);
  const closed = readClosedMonths(settingsMap);
  if (!closed.has(token)) {
    throw new Error(`${monthLabel(year, month)} is not marked closed.`);
  }
  closed.delete(token);
  await upsertSettingValue(
    accessToken,
    ALLOCATION_SETTING_KEYS.closedMonths,
    [...closed].sort().join(","),
    rowIndex
  );
  invalidateSettingsCache(accessToken);
  return getMonthlyAllocationReport(accessToken, year, month);
}

export async function getMonthlyAllocationReport(
  accessToken: string,
  year: number,
  month: number
): Promise<MonthlyAllocationReport> {
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const [settingsMap, masterRows, tabTitles, notarizations] = await Promise.all([
    readSettingsMap(accessToken),
    getAllMasterRows(accessToken),
    getSheetTitles(accessToken),
    listNotarizations(accessToken)
  ]);
  const allocationSettings = readAllocationSettings(settingsMap);

  const clients = clientsFromMaster(masterRows);
  const ledgers = await batchGetClientLedgerPayments(accessToken, clients, tabTitles);
  const paymentLines = collectOfficePaymentLines(clients, ledgers, year, month);
  const notarizationLines = collectNotarizationLines(year, month, notarizations);
  const appearanceFees = collectAppearanceFeeLines(clients, ledgers, year, month);
  const acceptanceFees = collectAcceptanceFeeLines(clients, ledgers, year, month);
  const pleadingFees = collectPleadingFeeLines(clients, ledgers, year, month);
  const unclassifiedIncome = collectUnclassifiedIncomeLines(clients, ledgers, year, month);

  const priorMonth = month === 1 ? 12 : month - 1;
  const priorYear = month === 1 ? year - 1 : year;
  const priorMonthIncome = sumMonthOfficeIncome(clients, ledgers, notarizations, priorYear, priorMonth);

  const priorYearSameMonthIncome = sumMonthOfficeIncome(
    clients,
    ledgers,
    notarizations,
    year - 1,
    month
  );

  const closedMonths = readClosedMonths(settingsMap);
  const rollingMonths: RollingMonthSummary[] = [-2, -1, 0].map((offset) => {
    const target = shiftAllocationMonth(year, month, offset);
    const token = monthCloseToken(target.year, target.month);
    return {
      year: target.year,
      month: target.month,
      monthLabel: monthLabel(target.year, target.month),
      shortLabel: monthShortLabel(target.year, target.month),
      totalIncome: sumMonthOfficeIncome(clients, ledgers, notarizations, target.year, target.month),
      monthClosed: closedMonths.has(token)
    };
  });

  const lines = [...paymentLines, ...notarizationLines].sort((a, b) => {
    const da = parseDate(a.date)?.getTime() ?? 0;
    const db = parseDate(b.date)?.getTime() ?? 0;
    return db - da;
  });

  const totalAcceptanceFees =
    Math.round(acceptanceFees.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const totalAcceptanceFirmShare =
    Math.round(acceptanceFees.reduce((sum, line) => sum + line.firmShare, 0) * 100) / 100;
  const totalPleadingFees =
    Math.round(pleadingFees.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const totalPleadingFirmShare =
    Math.round(pleadingFees.reduce((sum, line) => sum + line.firmShare, 0) * 100) / 100;
  const pleadingFeeSharing = summarizePleadingFeeSharing(pleadingFees);
  const acceptanceFeeSharing = summarizeAcceptanceFeeSharing(acceptanceFees);

  const totalIncome =
    Math.round(
      (lines.reduce((sum, line) => sum + line.amount, 0) +
        totalAcceptanceFirmShare +
        totalPleadingFirmShare) *
        100
    ) / 100;
  const splits = computeAllocationSplits(totalIncome, allocationSettings.percents);
  const totalAppearanceFees =
    Math.round(appearanceFees.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const totalUnclassifiedIncome =
    Math.round(unclassifiedIncome.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;

  const token = monthCloseToken(year, month);

  const sourceBreakdown = summarizeOfficeIncomeSources(lines);
  sourceBreakdown.acceptance = totalAcceptanceFees;

  const reportDraft: MonthlyAllocationReport = {
    year,
    month,
    monthLabel: monthLabel(year, month),
    settings: allocationSettings,
    lines,
    totalIncome,
    splits,
    sourceBreakdown,
    appearanceFees,
    appearanceFeeByAttorney: summarizeAppearanceFeesByAttorney(appearanceFees),
    totalAppearanceFees,
    acceptanceFees,
    acceptanceFeeSharing,
    totalAcceptanceFees,
    totalAcceptanceFirmShare,
    pleadingFees,
    pleadingFeeSharing,
    totalPleadingFees,
    totalPleadingFirmShare,
    unclassifiedIncome,
    totalUnclassifiedIncome,
    monthClosed: closedMonths.has(token),
    closedAt: settingsMap.get(monthClosedAtKey(year, month)) || undefined,
    priorMonthIncome,
    incomeChangePct: computeIncomeChangePct(totalIncome, priorMonthIncome),
    priorYearSameMonthIncome,
    priorYearChangePct: computeIncomeChangePct(totalIncome, priorYearSameMonthIncome),
    rollingMonths,
    closeChecklist: [],
    bucketBalances: buildBucketBalances(settingsMap, splits),
    bucketAdjustments: readBucketAdjustments(settingsMap)
  };

  reportDraft.closeChecklist = buildMonthCloseChecklist(reportDraft);
  return reportDraft;
}
