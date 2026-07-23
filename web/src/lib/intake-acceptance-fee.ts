import type { EngagementDocumentType } from "@/lib/engagement-letter";
import { parseMoney, type LedgerEntry } from "@/lib/gl-config";
import { resolveContractAcceptanceFee } from "@/lib/litigation-venue-fees";

export const INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER = "INTAKE_ACCEPTANCE_FEE";
const PENDING_CHARGE_STORAGE_KEY = "gl-intake-pending-acceptance-fee";

export type IntakePendingAcceptanceFee = {
  clientCode: string;
  amount: string;
  category: string;
  description: string;
};

export function shouldOfferIntakeAcceptanceFeeCharge(input: {
  engagementLetter?: boolean;
  documentType?: EngagementDocumentType;
}): boolean {
  return Boolean(input.engagementLetter && input.documentType === "contract");
}

export function resolveIntakeAcceptanceFeeAmount(input: {
  acceptanceFeeAmount?: string;
  caseTitle?: string;
  courtPending?: string;
}): number {
  const parsed = parseMoney(input.acceptanceFeeAmount);
  if (parsed > 0) return parsed;
  return resolveContractAcceptanceFee(input.caseTitle || "", input.courtPending || "").acceptanceFee;
}

export function intakeAcceptanceFeeDescription(): string {
  return `Acceptance fee — matter intake (${INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER})`;
}

export function ledgerHasIntakeAcceptanceFee(entries: Array<Pick<LedgerEntry, "category" | "description" | "charge">>): boolean {
  return entries.some(
    (row) =>
      row.charge > 0 &&
      (row.category === "Acceptance Fee" || row.description.includes(INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER))
  );
}

export function saveIntakePendingAcceptanceFee(payload: IntakePendingAcceptanceFee): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_CHARGE_STORAGE_KEY, JSON.stringify(payload));
}

export function intakePendingAcceptanceFeeMatchesClient(
  storedCode: string,
  ...clientCodes: string[]
): boolean {
  const stored = storedCode.trim().toUpperCase();
  if (!stored) return false;
  return clientCodes
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
    .some((code) => code === stored || code.startsWith(stored) || stored.startsWith(code));
}

export function readIntakePendingAcceptanceFee(...clientCodes: string[]): IntakePendingAcceptanceFee | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PENDING_CHARGE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IntakePendingAcceptanceFee;
    if (!parsed.amount?.trim()) return null;
    if (!intakePendingAcceptanceFeeMatchesClient(parsed.clientCode || "", ...clientCodes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntakePendingAcceptanceFee(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_CHARGE_STORAGE_KEY);
}

export function buildIntakePendingAcceptanceFee(input: {
  clientCode: string;
  acceptanceFeeAmount?: string;
  caseTitle?: string;
  courtPending?: string;
}): IntakePendingAcceptanceFee | null {
  const amount = resolveIntakeAcceptanceFeeAmount(input);
  if (!amount || amount <= 0) return null;
  return {
    clientCode: input.clientCode.trim().toUpperCase(),
    amount: String(amount),
    category: "Acceptance Fee",
    description: intakeAcceptanceFeeDescription()
  };
}
