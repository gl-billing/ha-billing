import { formatPeso } from "@/lib/gl-config";
import { parseLedgerDateToIso } from "@/lib/ledger/parse-ledger-date";
import {
  buildRetainerHomeReadiness,
  formatRetainerDirectoryLabel,
  mergeRetainerPackage,
  resolveRetainerDetailsFromClient,
  summarizePackageCoverage
} from "@/lib/retainer-package";
import {
  retainerBillingPeriodKey,
  retainerMonthlyChargeMarker
} from "@/lib/retainer-billing-autopilot-utils";
import { todayYmd } from "@/lib/office-tasks/schedule";

export type RetainerMonthCell = {
  periodKey: string;
  label: string;
  posted: boolean;
  emailed: boolean;
  paid: boolean;
  late: boolean;
};

export type RetainerMonthRollup = {
  periodKey: string;
  retainerCount: number;
  chargedAmount: number;
  paidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  notarialsUsed: number;
  missingEmailCount: number;
};

export type RetainerDigestLine = {
  clientCode: string;
  clientName: string;
  fee: number;
  dueDate: string;
  emailOk: boolean;
  directoryLabel: string;
};

function monthLabel(periodKey: string): string {
  const d = new Date(`${periodKey}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return periodKey;
  const month = d.toLocaleDateString("en-PH", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

function shiftPeriodKey(periodKey: string, monthsBack: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  const date = new Date(y, m - 1 - monthsBack, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function entryPeriodKey(dateRaw: string | undefined): string | null {
  const raw = String(dateRaw || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}/.test(raw)) return retainerBillingPeriodKey(raw);
  const iso = parseLedgerDateToIso(raw);
  if (iso) return retainerBillingPeriodKey(iso);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return retainerBillingPeriodKey(parsed.toISOString().slice(0, 10));
}

function paymentsInPeriod(
  entries: Array<{ date?: string; payment?: number; type?: string }>,
  periodKey: string
): number {
  return entries.reduce((sum, row) => {
    if (entryPeriodKey(row.date) !== periodKey) return sum;
    const type = String(row.type || "").toLowerCase();
    if (type === "void") return sum;
    return sum + (Number(row.payment) || 0);
  }, 0);
}

function chargeAmountInPeriod(
  entries: Array<{ date?: string; charge?: number; description?: string; type?: string }>,
  clientCode: string,
  periodKey: string
): number {
  const marker = retainerMonthlyChargeMarker(clientCode, periodKey).toLowerCase();
  return entries.reduce((sum, row) => {
    if ((Number(row.charge) || 0) <= 0) return sum;
    const type = String(row.type || "").toLowerCase();
    if (type === "void") return sum;
    if (!String(row.description || "").toLowerCase().includes(marker)) return sum;
    return sum + (Number(row.charge) || 0);
  }, 0);
}

/**
 * Autopilot uses the strict marker. The staff ribbon also recognizes a manual
 * Professional Fee / retainership charge in that month when the amount matches the fee.
 */
export function retainerMonthChargeAmountForDisplay(
  entries: Array<{
    date?: string;
    charge?: number;
    description?: string;
    category?: string;
    type?: string;
  }>,
  clientCode: string,
  periodKey: string,
  fee: number
): number {
  const marked = chargeAmountInPeriod(entries, clientCode, periodKey);
  if (marked > 0.005) return marked;

  const feeAmt = Number(fee) || 0;
  let best = 0;
  for (const row of entries) {
    const charge = Number(row.charge) || 0;
    if (charge <= 0.005) continue;
    const type = String(row.type || "").toLowerCase();
    if (type === "void") continue;
    if (entryPeriodKey(row.date) !== periodKey) continue;

    const desc = String(row.description || "").toLowerCase();
    const cat = String(row.category || "").toLowerCase();
    const looksRetainer =
      desc.includes("retainer") ||
      desc.includes("retainership") ||
      desc.includes("monthly fee") ||
      desc.includes("monthly retainership");
    const looksProfessional =
      cat.includes("professional") || desc.includes("professional fee");

    if (looksRetainer) {
      if (feeAmt <= 0.005 || Math.abs(charge - feeAmt) < 0.51 || charge + 0.005 >= feeAmt * 0.9) {
        best = Math.max(best, charge);
      }
      continue;
    }
    if (looksProfessional && feeAmt > 0.005 && Math.abs(charge - feeAmt) < 0.51) {
      best = Math.max(best, charge);
    } else if (looksProfessional && feeAmt <= 0.005) {
      // Fee not configured yet — still treat an in-month Professional Fee as the cycle charge.
      best = Math.max(best, charge);
    }
  }
  return best;
}

function soaInPeriod(soaDates: string[], periodKey: string): boolean {
  return soaDates.some((raw) => entryPeriodKey(raw) === periodKey);
}

/** 12-month ribbon for a retainer matter (oldest → newest). */
export function buildRetainerMonthRibbon(input: {
  clientCode: string;
  fee: number;
  dueDay: number | null;
  balance: number;
  ledgerEntries: Array<{ date?: string; charge?: number; payment?: number; description?: string; category?: string; type?: string }>;
  soaDates?: string[];
  today?: string;
}): RetainerMonthCell[] {
  const today = input.today || todayYmd();
  const currentPeriod = retainerBillingPeriodKey(today);
  const cells: RetainerMonthCell[] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const periodKey = shiftPeriodKey(currentPeriod, i);
    const charged = retainerMonthChargeAmountForDisplay(
      input.ledgerEntries,
      input.clientCode,
      periodKey,
      input.fee
    );
    const posted = charged > 0.005;
    const paidAmt = paymentsInPeriod(input.ledgerEntries, periodKey);
    const emailed = soaInPeriod(input.soaDates || [], periodKey);
    const fee = charged > 0.005 ? charged : input.fee;
    const paid =
      posted &&
      (paidAmt + 0.005 >= fee || (periodKey === currentPeriod && input.balance <= 0.005));
    const dueDay = input.dueDay && input.dueDay >= 1 && input.dueDay <= 28 ? input.dueDay : 5;
    const dueYmd = `${periodKey}-${String(dueDay).padStart(2, "0")}`;
    const late = posted && !paid && dueYmd < today;

    cells.push({
      periodKey,
      label: monthLabel(periodKey),
      posted,
      emailed,
      paid,
      late
    });
  }

  return cells;
}

/** One-sentence beat for the current month cell in the staff ribbon. */
export function describeCurrentRetainerMonth(
  cells: RetainerMonthCell[],
  today?: string
): string {
  const current = retainerBillingPeriodKey(today || todayYmd());
  const cell = cells.find((row) => row.periodKey === current);
  if (!cell) return "";
  if (cell.late) return `${cell.label}: fee posted — payment overdue.`;
  if (cell.paid) {
    return cell.emailed
      ? `${cell.label}: fee posted, statement sent, and paid.`
      : `${cell.label}: fee posted and paid.`;
  }
  if (cell.posted) {
    return cell.emailed
      ? `${cell.label}: fee posted and statement sent — awaiting payment.`
      : `${cell.label}: fee posted — awaiting payment.`;
  }
  return `${cell.label}: not billed yet this cycle.`;
}

export function summarizeRetainerLedgersForPeriod(input: {
  periodKey: string;
  clients: Array<{
    code: string;
    name: string;
    email?: string | null;
    balance?: number;
    matterType?: string | null;
    caseTitle?: string | null;
    retainerBalance?: number | null;
    retainerDueDay?: string | number | null;
    intakePathDetails?: string | null;
    ledgerEntries: Array<{ date?: string; charge?: number; payment?: number; description?: string; category?: string; type?: string }>;
  }>;
  notarialsUsed?: number;
}): RetainerMonthRollup {
  let chargedAmount = 0;
  let paidAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let missingEmailCount = 0;
  let retainerCount = 0;

  for (const client of input.clients) {
    const readiness = buildRetainerHomeReadiness(client);
    if (!readiness) continue;
    retainerCount += 1;
    if (!readiness.emailOk) missingEmailCount += 1;

    const charged = retainerMonthChargeAmountForDisplay(
      client.ledgerEntries,
      client.code,
      input.periodKey,
      readiness.fee
    );
    const paidAmt = paymentsInPeriod(client.ledgerEntries, input.periodKey);
    if (charged > 0.005) {
      chargedAmount += charged;
      if (paidAmt + 0.005 >= charged || (Number(client.balance) || 0) <= 0.005) {
        paidAmount += charged;
      } else {
        overdueCount += 1;
        overdueAmount += Math.max(0, Number(client.balance) || charged - paidAmt);
      }
    } else if ((Number(client.balance) || 0) > 0.005) {
      overdueCount += 1;
      overdueAmount += Number(client.balance) || 0;
    }
  }

  return {
    periodKey: input.periodKey,
    retainerCount,
    chargedAmount,
    paidAmount,
    overdueCount,
    overdueAmount,
    notarialsUsed: input.notarialsUsed || 0,
    missingEmailCount
  };
}

export function listRetainerDigestForTomorrow(
  clients: Array<{
    code: string;
    name: string;
    email?: string | null;
    matterType?: string | null;
    caseTitle?: string | null;
    retainerBalance?: number | null;
    retainerDueDay?: string | number | null;
    intakePathDetails?: string | null;
  }>,
  options?: { today?: string }
): RetainerDigestLine[] {
  const today = options?.today || todayYmd();
  const tomorrow = addDaysYmd(today, 1);
  const rows: RetainerDigestLine[] = [];

  for (const client of clients) {
    const readiness = buildRetainerHomeReadiness(client, { today });
    if (!readiness?.nextBillingDate) continue;
    if (readiness.nextBillingDate !== tomorrow) continue;
    rows.push({
      clientCode: client.code,
      clientName: client.name,
      fee: readiness.fee,
      dueDate: readiness.nextBillingDate,
      emailOk: readiness.emailOk,
      directoryLabel: formatRetainerDirectoryLabel(client.code, client.name)
    });
  }

  return rows.sort((a, b) => a.clientCode.localeCompare(b.clientCode));
}

export function formatRetainerDigestOneLiner(rows: RetainerDigestLine[]): string {
  if (!rows.length) return "No retainer dues tomorrow.";
  const parts = rows.map((row) => {
    const fee = row.fee > 0 ? formatPeso(row.fee) : "fee unset";
    const email = row.emailOk ? "email OK" : "ADD EMAIL";
    return `${row.clientCode} ${fee}`;
  });
  const emailWarn = rows.filter((r) => !r.emailOk).length;
  const emailNote = emailWarn ? ` · ${emailWarn} missing email` : " — emails OK";
  return `Tomorrow: ${parts.join(", ")}${emailNote}`;
}

export function buildRetainerSoaContext(client: {
  code?: string;
  name?: string;
  matterType?: string | null;
  caseTitle?: string | null;
  retainerBalance?: number | null;
  retainerDueDay?: string | number | null;
  email?: string | null;
  intakePathDetails?: string | null;
}, billingDate?: string) {
  const retainer = resolveRetainerDetailsFromClient(client);
  if (!retainer) return null;
  const fee = Number(retainer.retainerFee) || 0;
  const dueDay = Math.floor(Number(retainer.dueDay));
  const dueDayOk = Number.isFinite(dueDay) && dueDay >= 1 && dueDay <= 28 ? dueDay : null;
  const pkg = mergeRetainerPackage(retainer, client.code);
  const ymd = (billingDate || todayYmd()).slice(0, 10);
  const monthLabel = (() => {
    const d = new Date(`${ymd.slice(0, 7)}-01T12:00:00`);
    if (Number.isNaN(d.getTime())) return ymd.slice(0, 7);
    return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  })();

  return {
    isRetainer: true as const,
    monthLabel,
    fee,
    dueDay: dueDayOk,
    packageCoverage: summarizePackageCoverage(pkg) || pkg.packageNotes || "",
    caseTitleOverride: `Monthly retainership — ${monthLabel}`,
    packageNotes: pkg.packageNotes || summarizePackageCoverage(pkg)
  };
}

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
