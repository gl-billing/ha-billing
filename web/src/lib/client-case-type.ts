import { isMarriageNullityOrAnnulmentCase } from "@/lib/litigation-venue-fees";

export type ClientCaseType =
  | "civil"
  | "criminal"
  | "administrative"
  | "annulment"
  | "labor"
  | "special_civil_action"
  | "special_proceeding"
  | "other";

export const CLIENT_CASE_TYPE_OPTIONS: ClientCaseType[] = [
  "civil",
  "criminal",
  "administrative",
  "annulment",
  "labor",
  "special_civil_action",
  "special_proceeding",
  "other"
];

export const CLIENT_CASE_TYPE_LABELS: Record<ClientCaseType, string> = {
  civil: "Civil",
  criminal: "Criminal",
  administrative: "Administrative",
  annulment: "Annulment",
  labor: "Labor",
  special_civil_action: "Special civil action",
  special_proceeding: "Special proceeding",
  other: "Others, please specify"
};

const CASE_TYPE_ALIASES: Record<string, ClientCaseType> = {
  civil: "civil",
  criminal: "criminal",
  administrative: "administrative",
  annulment: "annulment",
  labor: "labor",
  "special civil action": "special_civil_action",
  special_civil_action: "special_civil_action",
  "special proceeding": "special_proceeding",
  special_proceeding: "special_proceeding",
  other: "other",
  others: "other"
};

export function normalizeClientCaseType(value: unknown): ClientCaseType | "" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  return CASE_TYPE_ALIASES[raw] || "";
}

export function formatClientCaseTypeLabel(
  caseType: unknown,
  caseTypeOther?: string | null
): string {
  const normalized = normalizeClientCaseType(caseType);
  if (!normalized) return "";
  if (normalized === "other") {
    const other = String(caseTypeOther ?? "").trim();
    return other || CLIENT_CASE_TYPE_LABELS.other;
  }
  return CLIENT_CASE_TYPE_LABELS[normalized];
}

export function isAnnulmentCaseType(caseType: unknown): boolean {
  return normalizeClientCaseType(caseType) === "annulment";
}

/** Psychologist fields for annulment case type (or legacy nullity titles). */
export function showPsychologistFields(input: {
  caseType?: string | null;
  caseTitle?: string | null;
}): boolean {
  if (isAnnulmentCaseType(input.caseType)) return true;
  return isMarriageNullityOrAnnulmentCase(String(input.caseTitle ?? ""));
}

export function caseTypeOtherRequired(caseType: unknown): boolean {
  return normalizeClientCaseType(caseType) === "other";
}
