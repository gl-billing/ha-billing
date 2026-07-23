import { formatPeso } from "@/lib/gl-config";
import { resolveClientMatterType } from "@/lib/client-matter-type";
import {
  nextRetainerBillingDateYmd,
  normalizeRetainerBillingCycle,
  parseIntakePathDetails,
  type RetainerIntakeDetails
} from "@/lib/intake-path-workflows";
import { todayYmd } from "@/lib/office-tasks/schedule";

export type RetainerNotarialRule = "free" | "fixed" | "charge";

export type RetainerPackageDetails = {
  freeConsultations?: boolean;
  /** Simple / ordinary notarials covered at no charge. */
  freeSimpleNotarials?: boolean;
  /** Deed of Sale (and similar conveyance) treatment. */
  deedOfSaleRule?: RetainerNotarialRule;
  deedOfSaleFee?: number | string;
  /** Meetings / compromises — staff chooses per engagement. */
  meetingsRule?: "included" | "case_by_case" | "always_charged";
  packageNotes?: string;
};

export type RetainerHomeReadiness = {
  ready: boolean;
  feeOk: boolean;
  dueDayOk: boolean;
  emailOk: boolean;
  autoBilling: boolean;
  autoSoa: boolean;
  fee: number;
  dueDay: number | null;
  email: string;
  nextBillingDate: string | null;
  package: RetainerPackageDetails;
  missing: string[];
};

const DEED_OF_SALE_RE = /\bdeed\s+of\s+sale\b|\bdos\b|\babsolute\s+sale\b/i;

export function parseRetainerPackage(raw: RetainerIntakeDetails | undefined | null): RetainerPackageDetails {
  const pkg = (raw as RetainerIntakeDetails & { package?: RetainerPackageDetails })?.package;
  if (pkg && typeof pkg === "object") {
    return {
      freeConsultations: pkg.freeConsultations !== false,
      freeSimpleNotarials: Boolean(pkg.freeSimpleNotarials),
      deedOfSaleRule: pkg.deedOfSaleRule || "charge",
      deedOfSaleFee: pkg.deedOfSaleFee,
      meetingsRule: pkg.meetingsRule || "case_by_case",
      packageNotes: pkg.packageNotes?.trim() || ""
    };
  }
  return {
    freeConsultations: true,
    freeSimpleNotarials: false,
    deedOfSaleRule: "charge",
    deedOfSaleFee: undefined,
    meetingsRule: "case_by_case",
    packageNotes: ""
  };
}

/** Seed known firm retainers when package JSON is empty (editable afterward). */
export function defaultPackageForRetainerCode(clientCode: string): RetainerPackageDetails {
  const code = String(clientCode || "").trim().toUpperCase();
  if (code === "RET-ENA" || code === "IQBAL" || code.startsWith("IQBAL")) {
    return {
      freeConsultations: true,
      freeSimpleNotarials: false,
      deedOfSaleRule: "fixed",
      deedOfSaleFee: 500,
      meetingsRule: "case_by_case",
      packageNotes: "Free consultation. Deed of Sale notarization ₱500 each. Meetings/compromises case-by-case."
    };
  }
  if (code === "RET-FUSION" || code === "RET-LOGIC") {
    return {
      freeConsultations: true,
      freeSimpleNotarials: true,
      deedOfSaleRule: "free",
      deedOfSaleFee: 0,
      meetingsRule: "case_by_case",
      packageNotes: "Deed of Sale notarization included. Meetings/compromises case-by-case."
    };
  }
  return parseRetainerPackage(null);
}

export function mergeRetainerPackage(
  retainer: RetainerIntakeDetails | undefined,
  clientCode?: string
): RetainerPackageDetails {
  const stored = parseRetainerPackage(retainer);
  const hasStored =
    Boolean(retainer && (retainer as { package?: unknown }).package) ||
    Boolean(stored.packageNotes);
  if (hasStored) return stored;
  return defaultPackageForRetainerCode(clientCode || "");
}

export function resolveRetainerDetailsFromClient(client: {
  code?: string;
  matterType?: string | null;
  caseTitle?: string | null;
  retainerBalance?: number | null;
  retainerDueDay?: string | number | null;
  email?: string | null;
  intakePathDetails?: string | null;
}): RetainerIntakeDetails | null {
  const path = parseIntakePathDetails(client.intakePathDetails);
  const matterType = resolveClientMatterType({
    matterType: client.matterType,
    caseTitle: client.caseTitle,
    retainerBalance: client.retainerBalance
  });
  if (path?.path !== "retainer" && matterType !== "retainer") return null;
  const retainer = { ...(path?.retainer || {}) };
  if (!retainer.dueDay && client.retainerDueDay) retainer.dueDay = client.retainerDueDay;
  if (!retainer.contactEmail && client.email) retainer.contactEmail = client.email;
  retainer.billingCycle = normalizeRetainerBillingCycle(retainer.billingCycle);
  retainer.autoMonthlyBilling = retainer.autoMonthlyBilling !== false;
  retainer.autoSoaOnDueDate = retainer.autoSoaOnDueDate !== false;
  (retainer as RetainerIntakeDetails & { package?: RetainerPackageDetails }).package =
    mergeRetainerPackage(retainer, client.code);
  return retainer;
}

export function buildRetainerHomeReadiness(
  client: {
    code: string;
    name?: string;
    matterType?: string | null;
    caseTitle?: string | null;
    retainerBalance?: number | null;
    retainerDueDay?: string | number | null;
    email?: string | null;
    intakePathDetails?: string | null;
  },
  options?: { today?: string }
): RetainerHomeReadiness | null {
  const retainer = resolveRetainerDetailsFromClient(client);
  if (!retainer) return null;

  const fee = Number(retainer.retainerFee) || 0;
  const dueRaw = String(retainer.dueDay ?? "").trim();
  const dueDay = Math.floor(Number(dueRaw));
  const dueDayOk = dueRaw !== "" && Number.isFinite(dueDay) && dueDay >= 1 && dueDay <= 28;
  const feeOk = fee > 0.005;
  const email = String(client.email || "").trim();
  const emailOk = Boolean(email);
  const missing: string[] = [];
  if (!feeOk) missing.push("Monthly fee");
  if (!dueDayOk) missing.push("Due day");
  if (!emailOk) missing.push("Master contact email");

  const today = options?.today || todayYmd();
  const nextBillingDate = dueDayOk
    ? nextRetainerBillingDateYmd(
        normalizeRetainerBillingCycle(retainer.billingCycle),
        dueDay,
        new Date(`${today}T12:00:00`)
      )
    : null;

  return {
    ready: missing.length === 0,
    feeOk,
    dueDayOk,
    emailOk,
    autoBilling: retainer.autoMonthlyBilling !== false,
    autoSoa: retainer.autoSoaOnDueDate !== false,
    fee,
    dueDay: dueDayOk ? dueDay : null,
    email,
    nextBillingDate,
    package: mergeRetainerPackage(retainer, client.code),
    missing
  };
}

export type UpcomingRetainerBilling = {
  clientCode: string;
  clientName: string;
  fee: number;
  dueDate: string;
  email: string;
  emailOk: boolean;
  autoBilling: boolean;
  autoSoa: boolean;
  ready: boolean;
  directoryLabel: string;
};

export function listUpcomingRetainerBillings(
  clients: Array<{
    code: string;
    name: string;
    matterType?: string | null;
    caseTitle?: string | null;
    retainerBalance?: number | null;
    retainerDueDay?: string | number | null;
    email?: string | null;
    intakePathDetails?: string | null;
  }>,
  options?: { today?: string; withinDays?: number }
): UpcomingRetainerBilling[] {
  const today = options?.today || todayYmd();
  const withinDays = options?.withinDays ?? 14;
  const end = addDaysYmd(today, withinDays);
  const rows: UpcomingRetainerBilling[] = [];

  for (const client of clients) {
    const readiness = buildRetainerHomeReadiness(client, { today });
    if (!readiness || !readiness.nextBillingDate) continue;
    if (readiness.nextBillingDate < today || readiness.nextBillingDate > end) continue;
    rows.push({
      clientCode: client.code,
      clientName: client.name,
      fee: readiness.fee,
      dueDate: readiness.nextBillingDate,
      email: readiness.email,
      emailOk: readiness.emailOk,
      autoBilling: readiness.autoBilling,
      autoSoa: readiness.autoSoa,
      ready: readiness.ready,
      directoryLabel: formatRetainerDirectoryLabel(client.code, client.name)
    });
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.clientCode.localeCompare(b.clientCode));
}

export function formatRetainerDirectoryLabel(clientCode: string, clientName: string): string {
  const code = String(clientCode || "").trim().toUpperCase();
  const name = String(clientName || "").trim() || code;
  if (code.startsWith("RET-") || code === "RET-ENA") return `Retainer · ${name}`;
  if (code === "IQBAL" || code.startsWith("IQBAL")) return `Retainer · ${name}`;
  return `Retainer · ${name}`;
}

export function formatRetainerSoaDescription(input: {
  billingDate: string;
  fee: number;
  dueDay: number | null;
  package?: RetainerPackageDetails;
}): string {
  const monthLabel = formatMonthLabel(input.billingDate);
  const due =
    input.dueDay != null ? `Due day ${input.dueDay} of each month.` : "Monthly retainership billing.";
  const covered = summarizePackageCoverage(input.package);
  return `Monthly retainership — ${monthLabel} · ${formatPeso(input.fee)}. ${due}${covered ? ` ${covered}` : ""}`;
}

export function summarizePackageCoverage(pkg?: RetainerPackageDetails | null): string {
  if (!pkg) return "";
  const bits: string[] = [];
  if (pkg.freeConsultations !== false) bits.push("consultations included");
  if (pkg.deedOfSaleRule === "free") bits.push("Deed of Sale notarial included");
  else if (pkg.deedOfSaleRule === "fixed") {
    bits.push(`Deed of Sale notarial ${formatPeso(Number(pkg.deedOfSaleFee) || 0)} each`);
  }
  if (pkg.meetingsRule === "case_by_case") bits.push("meetings case-by-case");
  else if (pkg.meetingsRule === "included") bits.push("meetings included");
  else if (pkg.meetingsRule === "always_charged") bits.push("meetings billed separately");
  return bits.length ? `Covered: ${bits.join("; ")}.` : "";
}

export function resolveNotarialBillingFromPackage(input: {
  clientCode?: string | null;
  documentType?: string | null;
  matterType?: string | null;
  caseTitle?: string | null;
  retainerBalance?: number | null;
  intakePathDetails?: string | null;
}): { billingKind: "charge" | "retainer"; amount?: number; hint: string } | null {
  const retainer = resolveRetainerDetailsFromClient({
    code: input.clientCode || "",
    matterType: input.matterType,
    caseTitle: input.caseTitle,
    retainerBalance: input.retainerBalance,
    intakePathDetails: input.intakePathDetails
  });
  if (!retainer || !input.clientCode) return null;

  const pkg = mergeRetainerPackage(retainer, input.clientCode);
  const doc = String(input.documentType || "");
  if (DEED_OF_SALE_RE.test(doc)) {
    if (pkg.deedOfSaleRule === "free") {
      return { billingKind: "retainer", amount: 0, hint: "Deed of Sale covered by retainer — no fee." };
    }
    if (pkg.deedOfSaleRule === "fixed") {
      const amount = Number(pkg.deedOfSaleFee) || 500;
      return {
        billingKind: "charge",
        amount,
        hint: `Deed of Sale under this retainer — charge ${formatPeso(amount)}.`
      };
    }
    return { billingKind: "charge", hint: "Deed of Sale is billed under this retainer package." };
  }

  if (pkg.freeSimpleNotarials) {
    return { billingKind: "retainer", amount: 0, hint: "Simple notarial covered by retainer — no fee." };
  }

  return {
    billingKind: "retainer",
    amount: 0,
    hint: "Retainer client — default to covered notarial unless this document is always charged."
  };
}

export function suggestedRetainerHomeCode(clientCode: string, clientName: string): string | null {
  const code = String(clientCode || "").trim().toUpperCase();
  if (code === "RET-ENA") return null;
  if (code === "IQBAL" || (code.startsWith("IQBAL") && !code.includes("-"))) {
    return "RET-ENA";
  }
  const name = String(clientName || "").toLowerCase();
  if (code === "IQBAL" || name.includes("ena marika")) return "RET-ENA";
  return null;
}

function formatMonthLabel(ymd: string): string {
  const raw = String(ymd || "").trim().slice(0, 10);
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw || "this month";
  return date.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
