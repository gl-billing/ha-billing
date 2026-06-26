/** Mirrors GL constants from Apps Script — keep in sync with code.gs */
export const GL = {
  sheets: {
    settings: "Settings",
    master: "Master List",
    walkIn: "Walk-In Clients",
    spotBilling: "Spot Billing",
    notarization: "Notarizations",
    fieldDispatch: "Field Dispatch",
    dashboard: "Dashboard",
    documentLog: "Document Log",
    auditLog: "Audit Log"
  },
  notarizationHeaders: [
    "Receipt No.",
    "Date",
    "Name",
    "Document Type",
    "Doc No.",
    "Page No.",
    "Book No.",
    "Series",
    "Amount",
    "Payment Method",
    "Payment Details",
    "Client Code",
    "Notes",
    "Recorded By",
    "Receipt PDF",
    "Status",
    "Address",
    "Receipt Issued"
  ] as const,
  fieldDispatchHeaders: [
    "Dispatch ID",
    "Date",
    "Days",
    "Location",
    "Staff",
    "Client Code",
    "Purpose",
    "Advance Given",
    "Actual Expenses",
    "Returned to Office",
    "Service Fee",
    "Billable Total",
    "Reimbursement Status",
    "Billed Date",
    "Notes",
    "Recorded By",
    "Status",
    "Staff Salary Paid",
    "Staff Salary Paid Date"
  ] as const,
  walkInHeaders: [
    "Walk-In ID",
    "Date Added",
    "Client Name",
    "Consultation / Matter",
    "Phone",
    "Email",
    "Notes",
    "Status",
    "Promoted Client Code",
    "Charge Amount",
    "Payment Amount",
    "Payment Method",
    "Billing Date",
    "Billing Status",
    "Service Type"
  ] as const,
  spotBillingHeaders: [
    "Spot ID",
    "Date Added",
    "Payer Name",
    "Service / Matter",
    "Phone",
    "Email",
    "Notes",
    "Status",
    "Linked Client Code",
    "Charge Amount",
    "Payment Amount",
    "Payment Method",
    "Last Billing Date",
    "Billing Status",
    "Service Type",
    "Assigned Attorney"
  ] as const,
  ledgerStartRow: 8,
  masterHeaders: [
    "Client Code",
    "Client Name",
    "Case Title",
    "Case Number",
    "Contact Email",
    "Contact Phone",
    "Client Address",
    "Last Billing Date",
    "Prev Balance",
    "New Charges",
    "Payments",
    "Total Due",
    "SOA Sent",
    "Last Invoice Number",
    "Last Invoice URL",
    "Account Status",
    "AR Pending",
    "Last Activity",
    "Next Follow-up Date",
    "Preferred Greeting",
    "Client Status",
    "Court Pending",
    "Assigned Attorney",
    "Retainer Balance",
    "Close Reason",
    "Closed Date",
    "Case Role",
    "Birthday",
    "Birthday Greeting Sent",
    "Psychologist Name",
    "Psychologist Phone",
    "Psychologist Address",
    "Matter Type",
    "Case Type",
    "Case Type Other"
  ] as const,
  ledgerHeaders: [
    "Date",
    "Type",
    "Category",
    "Description",
    "Charge",
    "Payment",
    "Balance",
    "Method",
    "Details",
    "Invoice / AR No.",
    "AR Sent",
    "AR PDF Link"
  ] as const,
  chargeCategories: [
    "Acceptance Fee",
    "Professional Fee",
    "Appearance Fee",
    "Filing Fee",
    "Notarial Fee",
    "Transportation",
    "Reimbursement",
    "Other"
  ] as const,
  paymentMethods: ["Cash", "Bank Transfer", "GCash", "Maya", "Check"] as const
} as const;

/** Standard Client / Case label on Master Tasks (matches intake). */
export function formatClientCaseLabel(name: string, matter: string): string {
  const n = String(name || "").trim();
  const m = String(matter || "").trim();
  if (n && m) return `${n} — ${m}`;
  return n || m;
}

export type CaseOption = {
  id: string;
  label: string;
  name: string;
  matter: string;
  kind: "master" | "walkin" | "task" | "firm";
  clientCode?: string;
  walkInId?: string;
  /** Court where pending (Master List) or last known venue from events. */
  courtPending?: string;
  assignedAttorney?: string;
  email?: string;
  phone?: string;
};

/** Sort client/case picker options by client name, then matter title. */
export function compareCaseOptionsAlphabetically(a: CaseOption, b: CaseOption): number {
  const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base", ignorePunctuation: true });
  if (byName !== 0) return byName;
  const byMatter = a.matter.localeCompare(b.matter, "en", { sensitivity: "base", ignorePunctuation: true });
  if (byMatter !== 0) return byMatter;
  return (a.clientCode || a.label).localeCompare(b.clientCode || b.label, "en", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

export function sortCaseOptionsAlphabetically(options: CaseOption[]): CaseOption[] {
  return [...options].sort(compareCaseOptionsAlphabetically);
}

/** Client code key for + Task / + Event dropdown sorting. */
export function clientCodeForCaseOption(option: CaseOption): string {
  if (option.clientCode?.trim()) return option.clientCode.trim().toUpperCase();
  if (option.kind === "firm" && option.id.startsWith("firm:")) {
    return option.id.slice(5).toUpperCase();
  }
  if (option.walkInId?.trim()) return option.walkInId.trim().toUpperCase();
  const first = option.label.split(/\s+—\s+/)[0]?.trim() || "";
  if (/^[A-Z][A-Z0-9_-]{1,11}$/i.test(first)) return first.toUpperCase();
  const letters = option.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3) || option.label.toUpperCase();
}

/** Sort client/case picker options by client code, then label. */
export function compareCaseOptionsByClientCode(a: CaseOption, b: CaseOption): number {
  const byCode = clientCodeForCaseOption(a).localeCompare(clientCodeForCaseOption(b), "en", {
    sensitivity: "base",
    ignorePunctuation: true
  });
  if (byCode !== 0) return byCode;
  return a.label.localeCompare(b.label, "en", { sensitivity: "base", ignorePunctuation: true });
}

export function sortCaseOptionsByClientCode(options: CaseOption[]): CaseOption[] {
  return [...options].sort(compareCaseOptionsByClientCode);
}

/** Typical one-way drive time from Davao City (hours). */
export const FIELD_DISPATCH_TRAVEL_HOURS: Record<string, number> = {
  "Davao City": 0,
  Panabo: 0.75,
  Carmen: 1,
  Digos: 1.25,
  "Santa Cruz": 1.25,
  Tagum: 1.25,
  Kidapawan: 1.75,
  Nabunturan: 2,
  Compostela: 2,
  Monkayo: 2.25,
  Koronadal: 2.5,
  "General Santos": 2.75,
  Mati: 3.5,
  "Cotabato City": 3.5,
  Valencia: 4,
  Malaybalay: 4.5,
  "Cagayan de Oro": 5,
  Butuan: 6.5,
  Other: 2
};

/** Per-meal allowance included in the suggested advance (food while out). */
export const FIELD_DISPATCH_MEAL_ALLOWANCE = 200;

/**
 * One-way aircon bus fare from Davao Ecoland terminal + estimated tricycle/jeep at destination
 * (single location — court, municipal hall, etc.). Fares are typical published rates; verify at terminal.
 */
export type FieldDispatchRouteCosts = {
  busOneWay: number;
  tricycleLocal: number;
  /** When set, overrides meal count derived from travel hours. */
  meals?: number;
};

export const FIELD_DISPATCH_ROUTE_COSTS: Record<string, FieldDispatchRouteCosts> = {
  "Davao City": { busOneWay: 0, tricycleLocal: 0 },
  Panabo: { busOneWay: 85, tricycleLocal: 100 },
  Carmen: { busOneWay: 95, tricycleLocal: 100 },
  Digos: { busOneWay: 120, tricycleLocal: 120 },
  "Santa Cruz": { busOneWay: 130, tricycleLocal: 120 },
  Tagum: { busOneWay: 144, tricycleLocal: 120 },
  Kidapawan: { busOneWay: 260, tricycleLocal: 150 },
  Nabunturan: { busOneWay: 200, tricycleLocal: 150 },
  Compostela: { busOneWay: 240, tricycleLocal: 150 },
  Monkayo: { busOneWay: 220, tricycleLocal: 150 },
  Koronadal: { busOneWay: 240, tricycleLocal: 180 },
  "General Santos": { busOneWay: 300, tricycleLocal: 250 },
  Mati: { busOneWay: 390, tricycleLocal: 200 },
  "Cotabato City": { busOneWay: 550, tricycleLocal: 250 },
  Valencia: { busOneWay: 430, tricycleLocal: 200 },
  Malaybalay: { busOneWay: 490, tricycleLocal: 220 },
  "Cagayan de Oro": { busOneWay: 850, tricycleLocal: 300 },
  Butuan: { busOneWay: 850, tricycleLocal: 280 },
  Other: { busOneWay: 240, tricycleLocal: 150 }
};

/** Anchor: Gensan-distance (~2¾ hr) → ₱2,500 · CDO-distance (~5 hr) → ₱3,000 */
const FIELD_DISPATCH_GENSAN_HOURS = 2.75;
const FIELD_DISPATCH_GENSAN_AMOUNT = 2500;
const FIELD_DISPATCH_CDO_HOURS = 5;
const FIELD_DISPATCH_CDO_AMOUNT = 3000;

function roundFieldDispatchAmount(raw: number): number {
  if (raw <= 0) return 0;
  return Math.round(raw / 50) * 50;
}

/** Meals per full day away (breakfast, lunch, dinner). */
export const FIELD_DISPATCH_MEALS_PER_DAY = 3;

/** Same-day trips: meals scale with drive time. Overnight: 3 meals × days. */
export function fieldDispatchMealCount(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 2) return 1;
  if (hours < 5) return 2;
  return 3;
}

export function normalizeFieldDispatchDays(days: number | string | undefined): number {
  const n = Math.floor(Number(days) || 1);
  return Math.min(14, Math.max(1, n));
}

export function fieldDispatchMealCountForTrip(hours: number, days: number): number {
  const tripDays = normalizeFieldDispatchDays(days);
  if (tripDays > 1) return tripDays * FIELD_DISPATCH_MEALS_PER_DAY;
  return fieldDispatchMealCount(hours);
}

/** Whether a returned amount was entered (including 0 = all advance spent). */
export function fieldDispatchHasReturnedInput(value: number | string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== "";
}

/** True once returned/spent amounts have been recorded (reconcile or later). */
export function fieldDispatchIsReconciled(input: {
  status?: string;
  actualExpenses?: number | string;
  returnedToOffice?: number | string;
}): boolean {
  return (
    input.status === "Reconciled" ||
    (parseMoney(input.actualExpenses) || 0) > 0 ||
    (parseMoney(input.returnedToOffice) || 0) > 0
  );
}

/** Spent = advance given minus change returned to office. */
export function fieldDispatchSpentAmount(
  advance: number | string,
  returned: number | string
): number {
  const advanceAmount = Math.max(0, parseMoney(advance));
  const returnedAmount = Math.max(0, parseMoney(returned));
  if (returnedAmount > advanceAmount) {
    throw new Error("Returned amount cannot exceed advance given.");
  }
  return advanceAmount - returnedAmount;
}

/** Billable = spent (advance − returned) + liaison service fee. */
export function fieldDispatchBillableTotal(
  advance: number | string,
  returned: number | string,
  serviceFee: number | string,
  reconciled = true
): number {
  const spent = reconciled ? fieldDispatchSpentAmount(advance, returned) : 0;
  return spent + Math.max(0, parseMoney(serviceFee));
}

/** Jas salary credit from a trip = liaison fee minus change returned (advance is expense float). */
export function fieldDispatchSalaryCredit(
  serviceFee: number | string,
  returnedToOffice: number | string,
  reconciled = true
): number {
  if (!reconciled) return 0;
  const fee = Math.max(0, parseMoney(serviceFee));
  const returned = Math.max(0, parseMoney(returnedToOffice));
  return Math.round((fee - returned) * 100) / 100;
}

/** Salary credit for payroll: reconciled trips use fee − returned; open trips with a fee use the full fee. */
export function fieldDispatchSalaryCreditForEntry(entry: {
  serviceFee: number | string;
  returnedToOffice?: number | string;
  status?: string;
  actualExpenses?: number | string;
}): number {
  if (fieldDispatchIsReconciled(entry)) {
    return fieldDispatchSalaryCredit(entry.serviceFee, entry.returnedToOffice ?? 0, true);
  }
  const fee = Math.max(0, parseMoney(entry.serviceFee));
  return fee > 0 ? Math.round(fee * 100) / 100 : 0;
}

export function parseFieldDispatchStaffSalaryPaid(value: string | undefined | null): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "yes" || normalized === "y" || normalized === "paid" || normalized === "true" || normalized === "1";
}

export type FieldDispatchAdvanceBreakdown = {
  days: number;
  busOneWay: number;
  busRoundTrip: number;
  mealCount: number;
  mealTotal: number;
  tricycleLocal: number;
  totalAdvance: number;
};

/** Suggested advance = round-trip bus + (₱200 × meals) + local fare (× days if overnight). */
export function computeFieldDispatchAdvanceBreakdown(
  location: string,
  days: number | string = 1
): FieldDispatchAdvanceBreakdown {
  const key = location.trim() || "Other";
  const tripDays = normalizeFieldDispatchDays(days);

  if (key === "Davao City") {
    return {
      days: tripDays,
      busOneWay: 0,
      busRoundTrip: 0,
      mealCount: 0,
      mealTotal: 0,
      tricycleLocal: 0,
      totalAdvance: 0
    };
  }

  const costs = FIELD_DISPATCH_ROUTE_COSTS[key] ?? FIELD_DISPATCH_ROUTE_COSTS.Other;
  const hours = FIELD_DISPATCH_TRAVEL_HOURS[key] ?? FIELD_DISPATCH_TRAVEL_HOURS.Other;
  const mealCount = costs.meals ?? fieldDispatchMealCountForTrip(hours, tripDays);
  const busRoundTrip = costs.busOneWay * 2;
  const mealTotal = mealCount * FIELD_DISPATCH_MEAL_ALLOWANCE;
  const tricycleLocal = costs.tricycleLocal * tripDays;
  const raw = busRoundTrip + mealTotal + tricycleLocal;

  return {
    days: tripDays,
    busOneWay: costs.busOneWay,
    busRoundTrip,
    mealCount,
    mealTotal,
    tricycleLocal,
    totalAdvance: roundFieldDispatchAmount(raw)
  };
}

/** Liaison service fee from drive time (separate from food/fare advance). */
export function computeFieldDispatchServiceFeeFromTravelHours(hours: number): number {
  if (hours <= 0) return 0;

  if (hours <= FIELD_DISPATCH_GENSAN_HOURS) {
    return roundFieldDispatchAmount(
      FIELD_DISPATCH_GENSAN_AMOUNT * (hours / FIELD_DISPATCH_GENSAN_HOURS)
    );
  }

  if (hours <= FIELD_DISPATCH_CDO_HOURS) {
    const span = FIELD_DISPATCH_CDO_HOURS - FIELD_DISPATCH_GENSAN_HOURS;
    const raw =
      FIELD_DISPATCH_GENSAN_AMOUNT +
      (FIELD_DISPATCH_CDO_AMOUNT - FIELD_DISPATCH_GENSAN_AMOUNT) * ((hours - FIELD_DISPATCH_GENSAN_HOURS) / span);
    return roundFieldDispatchAmount(raw);
  }

  const perHour =
    (FIELD_DISPATCH_CDO_AMOUNT - FIELD_DISPATCH_GENSAN_AMOUNT) /
    (FIELD_DISPATCH_CDO_HOURS - FIELD_DISPATCH_GENSAN_HOURS);
  return roundFieldDispatchAmount(FIELD_DISPATCH_CDO_AMOUNT + perHour * (hours - FIELD_DISPATCH_CDO_HOURS));
}

export function formatFieldDispatchTravelHours(hours: number): string {
  if (hours <= 0) return "In-city";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `~${m} min`;
  if (m === 0) return `~${h} hr`;
  return `~${h} hr ${m} min`;
}

/** Firm overrides for liaison service fee only (advance uses bus + meals + tricycle). */
const FIELD_DISPATCH_SERVICE_FEE_OVERRIDES: Partial<Record<string, number>> = {
  Digos: 1000,
  "Santa Cruz": 1000,
  Tagum: 1500,
  Nabunturan: 1500,
  Compostela: 1500
};

function buildFieldDispatchPresets(): Record<string, { defaultAdvance: number; serviceFee: number }> {
  const presets: Record<string, { defaultAdvance: number; serviceFee: number }> = {};
  for (const [name, hours] of Object.entries(FIELD_DISPATCH_TRAVEL_HOURS)) {
    const advance = computeFieldDispatchAdvanceBreakdown(name).totalAdvance;
    const serviceFee =
      FIELD_DISPATCH_SERVICE_FEE_OVERRIDES[name] ?? computeFieldDispatchServiceFeeFromTravelHours(hours);
    presets[name] = { defaultAdvance: advance, serviceFee };
  }
  return presets;
}

/** Default advance (bus + meals + local fare) and liaison service fee by area. */
export const FIELD_DISPATCH_LOCATION_PRESETS = buildFieldDispatchPresets();

export const FIELD_DISPATCH_LOCATIONS = Object.keys(FIELD_DISPATCH_TRAVEL_HOURS);

export const FIRM_STAFF_LIAISON = "James Bryan Aguilon (Liaison Officer)";
export const FIRM_STAFF_SECRETARY = "Ellyza Andrea Aguanta (Secretary)";

/** Default staff on new field dispatch rows — liaison officer only. */
export const DEFAULT_FIELD_DISPATCH_STAFF = FIRM_STAFF_LIAISON;

export const FIELD_DISPATCH_PURPOSES = [
  "Serve demand letter",
  "Court filing",
  "Hearing / appearance",
  "Document retrieval",
  "ROD/BIR/PSA & other agencies",
  "Client meeting",
  "Other"
] as const;

export type FieldDispatchEntry = {
  dispatchId: string;
  date: string;
  days: number;
  location: string;
  staff: string;
  clientCode: string;
  purpose: string;
  advanceGiven: number;
  actualExpenses: number;
  returnedToOffice: number;
  serviceFee: number;
  billableTotal: number;
  reimbursementStatus: string;
  billedDate: string;
  notes: string;
  recordedBy: string;
  status: string;
  staffSalaryPaid: boolean;
  staffSalaryPaidDate: string;
  rowNumber: number;
};

export type FieldDispatchPayload = {
  date?: string;
  days?: number | string;
  location: string;
  staff?: string;
  clientCode?: string;
  purpose: string;
  advanceGiven: number | string;
  actualExpenses?: number | string;
  returnedToOffice?: number | string;
  serviceFee: number | string;
  notes?: string;
  staffSalaryPaid?: boolean;
};

export type FieldDispatchReconcilePayload = {
  dispatchId: string;
  actualExpenses: number | string;
  returnedToOffice: number | string;
  notes?: string;
};

export type FieldDispatchEditPayload = {
  dispatchId: string;
  date?: string;
  days?: number | string;
  location: string;
  staff?: string;
  clientCode?: string;
  purpose: string;
  advanceGiven?: number | string;
  returnedToOffice?: number | string;
  serviceFee?: number | string;
  notes?: string;
};

export type WalkInClient = {
  walkInId: string;
  dateAdded: string;
  name: string;
  matter: string;
  phone: string;
  email: string;
  notes: string;
  status: string;
  promotedClientCode: string;
  chargeAmount: number;
  paymentAmount: number;
  paymentMethod: string;
  billingDate: string;
  billingStatus: string;
  serviceType: string;
  rowNumber: number;
};

export type WalkInClientPayload = {
  name: string;
  matter: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** Optional one-time billing when creating the walk-in. */
  billing?: WalkInBillingPayload;
};

export type WalkInBillingKind = "charge" | "retainer";

export type WalkInBillingPayload = {
  serviceType: string;
  charge: number | string;
  payment?: number | string;
  method?: string;
  date?: string;
  description?: string;
  /** Retainer visits are recorded without a charge or payment. */
  billingKind?: WalkInBillingKind;
};

/** Occasional payer — one or two transactions, not a walk-in visit and not on Master List. */
export type SpotBillingEntry = {
  spotId: string;
  dateAdded: string;
  payerName: string;
  serviceDescription: string;
  phone: string;
  email: string;
  notes: string;
  status: string;
  linkedClientCode: string;
  chargeAmount: number;
  paymentAmount: number;
  paymentMethod: string;
  lastBillingDate: string;
  billingStatus: string;
  serviceType: string;
  assignedAttorney: string;
  rowNumber: number;
};

export type SpotBillingTransactionKind = "charge" | "payment" | "retainer";

export type SpotBillingPayload = {
  payerName: string;
  serviceDescription: string;
  phone?: string;
  email?: string;
  notes?: string;
  linkedClientCode?: string;
  assignedAttorney?: string;
  /** Optional billing on create — charge only, payment only, or retainer note. */
  billing?: SpotBillingTransactionPayload;
};

export type SpotBillingTransactionPayload = {
  serviceType: string;
  charge?: number | string;
  payment?: number | string;
  method?: string;
  date?: string;
  description?: string;
  /** Charge records fees/expenses; payment records amount received (separate entries). */
  transactionKind?: SpotBillingTransactionKind;
  /** @deprecated Use transactionKind */
  billingKind?: WalkInBillingKind;
};

/** A single notarization entry — doubles as a notarial register row + receipt record. */
export type NotarizationEntry = {
  receiptNo: string;
  date: string;
  name: string;
  documentType: string;
  docNo: string;
  pageNo: string;
  bookNo: string;
  series: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  clientCode: string;
  notes: string;
  recordedBy: string;
  pdfLink: string;
  status: string;
  /** Payor address for acknowledgment receipt (optional). */
  address: string;
  /** Date acknowledgment receipt was generated (YYYY-MM-DD). */
  receiptIssuedAt: string;
  rowNumber: number;
};

export type NotarizationPayload = {
  date?: string;
  name: string;
  documentType: string;
  docNo?: string;
  pageNo?: string;
  bookNo?: string;
  series?: string;
  amount?: number | string;
  paymentMethod?: string;
  paymentDetails?: string;
  clientCode?: string;
  /** Optional address printed on the acknowledgment receipt. */
  address?: string;
  notes?: string;
  /** charge = fee collected; retainer = no charge (logged in register only). */
  billingKind?: WalkInBillingKind;
  /** When true, also generate the acknowledgment receipt PDF via Apps Script. */
  generateReceipt?: boolean;
  /** When true and clientCode is set, post a notarial payment to the client ledger. */
  postToLedger?: boolean;
};

/** Fields that can be corrected on an existing notarization row. */
export type NotarizationUpdatePayload = {
  receiptNo: string;
  date?: string;
  name: string;
  documentType: string;
  docNo?: string;
  pageNo?: string;
  bookNo?: string;
  series?: string;
  amount?: number | string;
  paymentMethod?: string;
  paymentDetails?: string;
  clientCode?: string;
  address?: string;
  notes?: string;
  billingKind?: WalkInBillingKind;
};

/** Data sent to Apps Script to render the acknowledgment receipt from the template tab. */
export type GenerateNotarialReceiptPayload = {
  receiptNo: string;
  date: string;
  name: string;
  address?: string;
  documentType: string;
  docNo?: string;
  pageNo?: string;
  bookNo?: string;
  series?: string;
  amount: number;
  paymentMethod?: string;
  paymentDetails?: string;
};

export type ClientSummary = {
  code: string;
  name: string;
  caseTitle: string;
  caseNumber?: string;
  balance: number;
  status: string;
  accountStatus: string;
  email: string;
  phone?: string;
  address?: string;
  assignedAttorney?: string;
  retainerBalance?: number;
  lastBillingDate?: string;
  soaSent?: string;
  courtPending?: string;
  caseRole?: string;
  birthday?: string;
  birthdayGreetingSent?: string;
  psychologistName?: string;
  psychologistPhone?: string;
  psychologistAddress?: string;
  matterType?: string;
  caseType?: string;
  caseTypeOther?: string;
};

export type ClientDetail = ClientSummary & {
  masterRow: number;
  prevBalance: number;
  newCharges: number;
  paymentsTotal: number;
  preferredGreeting: string;
  courtPending: string;
  lastBillingDate: string;
  nextFollowUp: string;
  lastInvoiceNumber: string;
  lastInvoiceUrl: string;
  soaSent: string;
  lastActivity: string;
  arPending: string;
  assignedAttorney: string;
  retainerBalance: number;
  closeReason: string;
  closedDate: string;
};

export type LedgerEntry = {
  sheetRow: number;
  date: string;
  type: string;
  category: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
  method: string;
  details: string;
  documentNumber: string;
  arSent: boolean;
  pdfLink: string;
};

export type ClientLedgerSummary = {
  totalDue: number;
  payments: number;
  charges: number;
  entryCount: number;
  chargeCount: number;
  paymentCount: number;
};

export type UpdateClientPayload = {
  clientName?: string;
  caseTitle?: string;
  caseNumber?: string;
  courtPending?: string;
  caseRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  clientAddress?: string;
  prevBalance?: number | string;
  preferredGreeting?: string;
  clientStatus?: string;
  assignedAttorney?: string;
  retainerBalance?: number | string;
  birthday?: string;
  psychologistName?: string;
  psychologistPhone?: string;
  psychologistAddress?: string;
  matterType?: string;
  caseType?: string;
  caseTypeOther?: string;
};

export type CloseClientPayload = {
  reason: string;
};

export type LedgerEditPayload = {
  clientCode: string;
  sheetRow: number;
  date?: string;
  category?: string;
  description?: string;
  charge?: number | string;
  payment?: number | string;
  method?: string;
  details?: string;
  /** Update category/description only — allowed on receipt-linked payments. */
  reclassifyIncome?: boolean;
};

export type BatchSoaPayload = {
  clientCodes: string[];
  deliveryAction?: "Send Now" | "Create Gmail Draft";
};

export type BatchSoaResult = {
  ok: boolean;
  message: string;
  results: Array<{ clientCode: string; ok: boolean; message?: string; error?: string }>;
};

export type ArAgingEntry = {
  code: string;
  name: string;
  caseTitle: string;
  balance: number;
  daysPastDue: number;
  bucket: "current" | "31-60" | "61-90" | "90+";
  lastBillingDate: string;
  accountStatus: string;
};

export type ArAgingReport = {
  generatedAt: string;
  totalOutstanding: number;
  buckets: {
    current: ArAgingEntry[];
    "31-60": ArAgingEntry[];
    "61-90": ArAgingEntry[];
    "90+": ArAgingEntry[];
  };
};

export type MonthlyCollectionsReport = {
  month: string;
  year: number;
  monthLabel: string;
  totalCharges: number;
  totalPayments: number;
  netCollected: number;
  chargeCount: number;
  paymentCount: number;
  byClient: Array<{
    code: string;
    name: string;
    charges: number;
    payments: number;
  }>;
};

export type AuditLogEntry = {
  logRow: number;
  timestamp: string;
  user: string;
  action: string;
  clientCode: string;
  summary: string;
  details: string;
};

export type SoaStatusReportPayload = {
  caseTitle: string;
  hearingDate: string;
  hearingTime: string;
  incident: string;
  handlingLawyer: string;
  summary: string;
};

export type GenerateSoaPayload = {
  clientCode: string;
  statusReport?: SoaStatusReportPayload | null;
  preferredGreeting?: string;
  deliveryAction?: "Send Now" | "Create Gmail Draft";
};

export type GenerateArPayload = {
  clientCode: string;
  sheetRow: number;
  method: string;
  details: string;
  description: string;
  extraNote?: string;
  preferredGreeting?: string;
  deliveryAction?: "Send Now" | "Create Gmail Draft";
};

export type DashboardSummary = {
  totalCollectibles: number;
  clientsWithBalance: number;
  overdueClients: number;
  paymentsRecorded: number;
  topBalances: Array<{
    code: string;
    name: string;
    caseTitle: string;
    totalDue: number;
    status: string;
  }>;
};

export type DocumentLogEntry = {
  logRow: number;
  timestamp: string;
  clientCode: string;
  clientName: string;
  documentType: string;
  documentNumber: string;
  amount: number;
  email: string;
  pdfUrl: string;
  status: string;
  user: string;
};

export type PendingArEntry = {
  clientCode: string;
  clientName: string;
  date: string;
  amount: number;
  description: string;
  method: string;
  details: string;
  sheetRow: number;
  receiptNumber: string;
  status: string;
};

export type FollowUpClient = {
  code: string;
  name: string;
  caseTitle: string;
  balance: number;
  nextFollowUp: string;
  accountStatus: string;
};

export type HomeDashboard = DashboardSummary & {
  pendingArCount: number;
  pendingAr: PendingArEntry[];
  recentDocuments: DocumentLogEntry[];
  overdueList: Array<{
    code: string;
    name: string;
    caseTitle: string;
    totalDue: number;
    accountStatus: string;
  }>;
  followUpThisWeek: FollowUpClient[];
};

export type ActivityItem = {
  id: string;
  date: string;
  sortKey: number;
  kind: "charge" | "payment" | "soa" | "ar" | "billing" | "task" | "hearing" | "task-action";
  title: string;
  subtitle: string;
  amount?: number;
  pdfUrl?: string;
  status?: string;
  /** Scroll target in client matter popup (Task/Event list below timeline). */
  matterAnchor?: string;
};

export type NewClientPayload = {
  clientCode: string;
  clientName: string;
  caseTitle: string;
  caseNumber?: string;
  courtPending?: string;
  caseRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  clientAddress?: string;
  prevBalance?: number | string;
  preferredGreeting?: string;
  clientStatus?: "Active" | "Inactive" | "Closed" | string;
  birthday?: string;
  psychologistName?: string;
  psychologistPhone?: string;
  psychologistAddress?: string;
  matterType?: string;
  caseType?: string;
  caseTypeOther?: string;
};

export type LedgerEntryPayload = {
  clientCode: string;
  type: "Charge" | "Payment";
  date: string;
  category?: string;
  description?: string;
  charge?: number | string;
  payment?: number | string;
  method?: string;
  details?: string;
};

export function filterClientsByQuery(clients: ClientSummary[], query: string): ClientSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;

  return clients.filter((c) => {
    const haystack = [
      c.code,
      c.name,
      c.caseTitle,
      c.caseNumber,
      c.email,
      c.phone,
      c.address,
      c.assignedAttorney,
      c.courtPending,
      c.caseRole,
      c.psychologistName,
      c.psychologistPhone,
      c.psychologistAddress
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sanitizeSheetName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[\\/?:\[\]*]/g, "")
    .substring(0, 99);
}

export function parseMoney(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[₱Php,\s]/gi, ""));
}

export function normalizePaymentMethod(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  const map: Record<string, string> = {
    cash: "Cash",
    "bank transfer": "Bank Transfer",
    bank: "Bank Transfer",
    transfer: "Bank Transfer",
    gcash: "GCash",
    "g-cash": "GCash",
    maya: "Maya",
    paymaya: "Maya",
    check: "Check",
    cheque: "Check"
  };
  return map[raw] || "";
}

export function formatPeso(value: number): string {
  return `₱${(Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function toCsvRow(values: unknown[]): string {
  return values
    .map((v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}
