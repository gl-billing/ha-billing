import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getClientPrefix } from "@/lib/office-tasks/sheets/source-id";

export const TAX_COMPLIANCE_CLIENT_CASE = "Tax Compliance";

export type FirmMatterKind = "tax" | "admin";

export type FirmMatterDef = {
  code: string;
  clientCase: string;
  title: string;
  subtitle: string;
  kind: FirmMatterKind;
};

/** Non-billing firm workspaces — first-class matters, not orphan data. */
export const FIRM_MATTERS: FirmMatterDef[] = [
  {
    code: "TAX",
    clientCase: TAX_COMPLIANCE_CLIENT_CASE,
    title: "Tax Compliance",
    subtitle: "BIR filings, deadlines, and firm tax work",
    kind: "tax"
  },
  {
    code: "ADM",
    clientCase: "Admin",
    title: "Office & Admin",
    subtitle: "Firm administration and internal tasks",
    kind: "admin"
  },
  {
    code: "OFF",
    clientCase: "Office",
    title: "Office",
    subtitle: "General office operations",
    kind: "admin"
  },
  {
    code: "FIR",
    clientCase: "Firm Admin",
    title: "Firm Admin",
    subtitle: "Owner admin queue",
    kind: "admin"
  }
];

const CODE_SET = new Set(FIRM_MATTERS.map((m) => m.code));
const CASE_SET = new Set(FIRM_MATTERS.map((m) => normalizeCase(m.clientCase)));

function normalizeCase(value: string): string {
  return value.trim().toLowerCase();
}

export function isFirmMatterCode(code: string): boolean {
  return CODE_SET.has(code.trim().toUpperCase());
}

export function getFirmMatterByCode(code: string): FirmMatterDef | null {
  const trimmed = code.trim().toUpperCase();
  return FIRM_MATTERS.find((m) => m.code === trimmed) ?? null;
}

export function getFirmMatterByClientCase(clientCase: string): FirmMatterDef | null {
  const normalized = normalizeCase(clientCase);
  return FIRM_MATTERS.find((m) => normalizeCase(m.clientCase) === normalized) ?? null;
}

export function matchesFirmMatterClientCase(clientCase: string): boolean {
  return CASE_SET.has(normalizeCase(clientCase));
}

/** Open task/event tied to a known firm matter label or code — exempt from orphan scans. */
export function isRegisteredFirmMatterItem(item: Pick<OfficeItem, "clientCase" | "id">): boolean {
  const caseLabel = item.clientCase?.trim();
  if (!caseLabel) return false;
  if (matchesFirmMatterClientCase(caseLabel)) return true;

  const prefix = getClientPrefix(caseLabel);
  if (isFirmMatterCode(prefix)) return true;

  const idPrefix = item.id?.match(/^([A-Z]{2,3})-(TASK|EVT)-/)?.[1] || "";
  return idPrefix ? isFirmMatterCode(idPrefix) : false;
}

export function firmMatterCaseOptions() {
  return FIRM_MATTERS.map((matter) => ({
    id: `firm:${matter.code}`,
    label: matter.clientCase,
    name: matter.title,
    matter: matter.subtitle,
    kind: "firm" as const,
    clientCode: matter.code
  }));
}
