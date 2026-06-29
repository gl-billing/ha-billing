import type { FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";
import type { StaffPayrollRosterEntry } from "@/lib/staff-payroll-roster";
import { DEFAULT_STAFF_MONTHLY_ALLOWANCE, STAFF_PAYROLL_BANK } from "@/lib/staff-salary";

/** Firm inbox — secretary Shiela; also the default outbound sender. */
export const FIRM_INBOX_EMAIL = "legal@hernandezlaw.info";

/** Firm owner / developer — always allowed to sign in regardless of ALLOWED_EMAIL_DOMAIN. */
export const FIRM_OWNER_EMAILS = ["janinerose1191@gmail.com"] as const;

export function isFirmOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return FIRM_OWNER_EMAILS.some((owner) => owner.toLowerCase() === normalized);
}

export const MANAGING_PARTNER = {
  displayName: "Atty. Robert Hernandez",
  emails: ["atty.hernandez@hernandezlaw.info", "atty.rahernandez@gmail.com"] as const
};

/** Acceptance fee sharing — 20% firm, 40% Atty. Hernandez, 40% other lawyer on the matter. */
export const ACCEPTANCE_FEE_SHARE_PERCENTS = {
  firm: 20,
  managingPartner: 40,
  associate: 40
} as const;

/** Drafting pleading fee sharing — 20% office, 50% drafting lawyer, 30% Atty. Hernandez. */
export const PLEADING_FEE_SHARE_PERCENTS = {
  firm: 20,
  managingPartner: 30,
  drafter: 50
} as const;

/** Appearance fees — 100% to the assigned / appearing lawyer (no firm split). */
export const APPEARANCE_FEE_LAWYER_SHARE_PERCENT = 100;

export const SECRETARY = {
  displayName: "Shiela",
  rosterName: "Shiela (Secretary)",
  /** Full name shown on client email signatures (SOA, AR, payslips, etc.). */
  signatureName: "Shiela Cabaniero",
  email: FIRM_INBOX_EMAIL
};

/** Hearing reminders and court-confirmation calls — both firm secretaries. */
export const FIRM_SECRETARIES = [
  {
    displayName: "Shiela Cabaniero",
    shortName: "Shiela",
    email: SECRETARY.email
  },
  {
    displayName: "Hiedee Escartin",
    shortName: "Hiedee",
    email: "rahernandez555@gmail.com"
  }
] as const;

/** Firm lawyers — fee-sharing roster (managing partner listed first). */
export const DEFAULT_FIRM_LAWYERS_ROSTER: FirmLawyerRosterEntry[] = [
  {
    id: "atty-robert-hernandez",
    displayName: MANAGING_PARTNER.displayName,
    designation: "Founding / Managing Partner",
    email: MANAGING_PARTNER.emails[0],
    feeSharePercent: APPEARANCE_FEE_LAWYER_SHARE_PERCENT,
    overseesTasks: true,
    active: true
  },
  {
    id: "atty-april-liz-parreno",
    displayName: "Atty. April Liz Parreno",
    designation: "Associate Lawyer",
    email: "lizparreno595@gmail.com",
    feeSharePercent: 50,
    overseesTasks: true,
    active: true
  },
  {
    id: "atty-jeff-pasagui",
    displayName: "Atty. Jeff Pasagui",
    designation: "Associate Lawyer",
    email: "jlppasagui@gmail.com",
    feeSharePercent: 50,
    overseesTasks: true,
    active: true
  }
];

/** Payroll roster — firm staff for semi-monthly compensation. */
export const DEFAULT_STAFF_PAYROLL_ROSTER: StaffPayrollRosterEntry[] = [
  {
    id: "shiela",
    displayName: "Shiela",
    shortName: "Shiela",
    role: "Secretary",
    email: SECRETARY.email,
    associatedLawyerName: "",
    associatedLawyerEmail: "",
    includesFieldDispatch: false,
    monthlyAllowance: DEFAULT_STAFF_MONTHLY_ALLOWANCE,
    payrollBank: STAFF_PAYROLL_BANK,
    payrollAccountNumber: "",
    active: true
  }
];

/** Employees sheet rows beyond lawyers synced from the roster. */
export const DEFAULT_FIRM_EMPLOYEE_ROWS: Array<[string, string, string, string]> = [
  [SECRETARY.rosterName, SECRETARY.email, "Secretary", "TRUE"]
];

export function defaultAdminEmails(): string[] {
  return [...FIRM_OWNER_EMAILS, ...MANAGING_PARTNER.emails];
}

export function defaultAllowedEmails(): string[] {
  return [
    ...FIRM_OWNER_EMAILS,
    ...MANAGING_PARTNER.emails,
    SECRETARY.email,
    ...DEFAULT_FIRM_LAWYERS_ROSTER.map((lawyer) => lawyer.email)
  ];
}
