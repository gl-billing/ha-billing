import { formatPeso } from "@/lib/gl-config";
import type { CorrespondenceLetterInput } from "@/lib/firm-correspondence-preview";

export type CorrespondenceMergeContext = {
  clientName?: string;
  clientCode?: string;
  caseTitle?: string;
  balance?: number;
  lastSoaDate?: string;
  lastBillingDate?: string;
  assignedAttorney?: string;
  letterDate?: string;
};

export type CorrespondenceMergeField = {
  token: string;
  label: string;
  description: string;
};

export const CORRESPONDENCE_MERGE_FIELDS: CorrespondenceMergeField[] = [
  { token: "{{client_name}}", label: "Client name", description: "Recipient / client name" },
  { token: "{{client_code}}", label: "Client code", description: "Matter code (e.g. GL-001)" },
  { token: "{{case_title}}", label: "Case title", description: "Caption or matter title" },
  { token: "{{balance}}", label: "Balance due", description: "Current ledger balance" },
  { token: "{{last_soa_date}}", label: "Last SOA date", description: "When the last SOA was sent" },
  { token: "{{last_billing_date}}", label: "Last billing", description: "Last billing activity date" },
  { token: "{{matter_ref}}", label: "Matter reference", description: "Subject / matter line" },
  { token: "{{letter_date}}", label: "Letter date", description: "Date on the letter" },
  { token: "{{signatory}}", label: "Signatory", description: "Attorney signing the letter" }
];

function formatMergeDate(value?: string): string {
  const text = value?.trim();
  if (!text) return "";
  const parsed = new Date(`${text.includes("T") ? text : `${text}T12:00:00`}`);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function buildCorrespondenceMergeMap(context: CorrespondenceMergeContext): Record<string, string> {
  return {
    "{{client_name}}": context.clientName?.trim() || "",
    "{{client_code}}": context.clientCode?.trim().toUpperCase() || "",
    "{{case_title}}": context.caseTitle?.trim() || "",
    "{{balance}}": context.balance != null && Number.isFinite(context.balance) ? formatPeso(context.balance) : "",
    "{{last_soa_date}}": formatMergeDate(context.lastSoaDate),
    "{{last_billing_date}}": formatMergeDate(context.lastBillingDate),
    "{{matter_ref}}": context.caseTitle?.trim() || context.clientCode?.trim() || "",
    "{{letter_date}}": formatMergeDate(context.letterDate),
    "{{signatory}}": context.assignedAttorney?.trim() || ""
  };
}

export function applyCorrespondenceMergeText(text: string, context: CorrespondenceMergeContext): string {
  const map = buildCorrespondenceMergeMap(context);
  let result = text;
  for (const [token, value] of Object.entries(map)) {
    result = result.split(token).join(value);
  }
  return result;
}

export function applyCorrespondenceMergeFields(
  input: CorrespondenceLetterInput,
  context: CorrespondenceMergeContext
): CorrespondenceLetterInput {
  const mergeContext: CorrespondenceMergeContext = {
    ...context,
    clientName: context.clientName || input.recipientName,
    clientCode: context.clientCode || input.clientCode,
    caseTitle: context.caseTitle || input.matterReference,
    letterDate: context.letterDate || input.letterDate,
    assignedAttorney: context.assignedAttorney || input.signatoryName
  };

  return {
    ...input,
    recipientName: applyCorrespondenceMergeText(input.recipientName, mergeContext),
    subjectLine: input.subjectLine ? applyCorrespondenceMergeText(input.subjectLine, mergeContext) : input.subjectLine,
    salutation: input.salutation ? applyCorrespondenceMergeText(input.salutation, mergeContext) : input.salutation,
    body: applyCorrespondenceMergeText(input.body, mergeContext),
    matterReference: input.matterReference
      ? applyCorrespondenceMergeText(input.matterReference, mergeContext)
      : input.matterReference
  };
}
