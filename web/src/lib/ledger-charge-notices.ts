import { formatBillingDate, formatBillingPeso } from "@/lib/billing-document-design";
import type { LedgerEntry } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  isConsultationEventCategory,
  isHearingEventCategory,
  resolveEventCategory,
  splitEventCategory
} from "@/lib/office-tasks/event-form-utils";
import {
  INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER,
  intakeAcceptanceFeeDescription
} from "@/lib/intake-acceptance-fee";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

export type PostedLedgerChargeNotice = {
  title: string;
  body: string;
  matterCode: string;
  matterLabel?: string;
  postedDate: string;
  amount: number;
};

export function formatLedgerNoticeDate(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return formatBillingDate(trimmed.slice(0, 10));
  }
  return trimmed;
}

export function matterLedgerLabel(clientCode: string, clientCase?: string): string {
  const code = clientCode.trim().toUpperCase();
  const label = String(clientCase || "").trim();
  if (!label) return code;
  return `${code} · ${label}`;
}

function sentencePhrase(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "this matter";
  if (/^[a-z]/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function findIntakeAcceptanceFeeLedgerEntry(
  entries: Array<Pick<LedgerEntry, "date" | "charge" | "category" | "description" | "type">>
): Pick<LedgerEntry, "date" | "charge" | "category" | "description"> | null {
  const match = entries.find(
    (entry) =>
      entry.type.toLowerCase() === "charge" &&
      entry.charge > 0 &&
      (entry.category === "Acceptance Fee" ||
        entry.description.includes(INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER) ||
        entry.description === intakeAcceptanceFeeDescription())
  );
  return match || null;
}

export function buildAcceptanceFeePostedNotice(input: {
  clientCode: string;
  clientCase?: string;
  amount: number;
  postedDate: string;
}): PostedLedgerChargeNotice {
  const matterCode = input.clientCode.trim().toUpperCase();
  const postedDate = formatLedgerNoticeDate(input.postedDate);
  const matterLabel = input.clientCase?.trim() || undefined;

  return {
    title: "Acceptance fee posted",
    body: `${formatBillingPeso(input.amount)} has been recorded on the client ledger upon registration of this matter.`,
    matterCode,
    matterLabel,
    postedDate,
    amount: input.amount
  };
}

export function buildAppearanceFeePostedNotice(input: {
  clientCode: string;
  clientCase?: string;
  amount: number;
  postedDate: string;
  hearingDate?: string;
  hearingLabel?: string;
}): PostedLedgerChargeNotice {
  const matterCode = input.clientCode.trim().toUpperCase();
  const postedDate = formatLedgerNoticeDate(input.postedDate);
  const hearingDate = input.hearingDate ? formatLedgerNoticeDate(input.hearingDate) : "";
  const hearingLabel = input.hearingLabel?.trim() || "hearing";
  const hearingPhrase = hearingDate
    ? `the ${hearingDate} hearing`
    : `the hearing (${sentencePhrase(hearingLabel)})`;

  return {
    title: "Appearance fee posted",
    body: `${formatBillingPeso(input.amount)} has been recorded on the client ledger for ${hearingPhrase}.`,
    matterCode,
    matterLabel: input.clientCase?.trim() || undefined,
    postedDate,
    amount: input.amount
  };
}

export function buildFilingFeePostedNotice(input: {
  clientCode: string;
  clientCase?: string;
  amount: number;
  postedDate: string;
  pleadingLabel?: string;
}): PostedLedgerChargeNotice {
  const matterCode = input.clientCode.trim().toUpperCase();
  const postedDate = formatLedgerNoticeDate(input.postedDate);
  const pleading = (input.pleadingLabel?.trim() || "this filing").toLowerCase();

  return {
    title: "Filing fee posted",
    body: `${formatBillingPeso(input.amount)} has been recorded on the client ledger for ${pleading}.`,
    matterCode,
    matterLabel: input.clientCase?.trim() || undefined,
    postedDate,
    amount: input.amount
  };
}

export function buildConsultationFeePostedNotice(input: {
  clientCode: string;
  clientCase?: string;
  amount: number;
  postedDate: string;
  consultationDate?: string;
  consultationLabel?: string;
}): PostedLedgerChargeNotice {
  const matterCode = input.clientCode.trim().toUpperCase();
  const postedDate = formatLedgerNoticeDate(input.postedDate);
  const consultationDate = input.consultationDate ? formatLedgerNoticeDate(input.consultationDate) : "";
  const consultationLabel = input.consultationLabel?.trim() || "consultation";
  const consultationPhrase = consultationDate
    ? `the ${consultationDate} consultation`
    : sentencePhrase(consultationLabel);

  return {
    title: "Consultation fee posted",
    body: `${formatBillingPeso(input.amount)} has been recorded on the client ledger for ${consultationPhrase}.`,
    matterCode,
    matterLabel: input.clientCase?.trim() || undefined,
    postedDate,
    amount: input.amount
  };
}

export function buildEventLedgerChargePostedNotice(
  form: Pick<
    EventFormInput,
    "category" | "categoryOther" | "clientCase" | "details" | "eventDate" | "filingDeadline" | "ledgerClientCode"
  >,
  input: { amount: number; postedDate: string }
): PostedLedgerChargeNotice {
  const clientCode = String(form.ledgerClientCode || "").trim().toUpperCase();
  const category = resolveEventCategory(form.category, form.categoryOther);

  if (isHearingEventCategory(category)) {
    return buildAppearanceFeePostedNotice({
      clientCode,
      clientCase: form.clientCase,
      amount: input.amount,
      postedDate: input.postedDate,
      hearingDate: form.eventDate?.trim() || form.filingDeadline?.trim(),
      hearingLabel: form.details
    });
  }

  if (isConsultationEventCategory(category)) {
    return buildConsultationFeePostedNotice({
      clientCode,
      clientCase: form.clientCase,
      amount: input.amount,
      postedDate: input.postedDate,
      consultationDate: form.eventDate?.trim() || form.filingDeadline?.trim(),
      consultationLabel: form.details
    });
  }

  return buildFilingFeePostedNotice({
    clientCode,
    clientCase: form.clientCase,
    amount: input.amount,
    postedDate: input.postedDate,
    pleadingLabel: form.details
  });
}

export function formatPostedLedgerChargeNotice(notice: PostedLedgerChargeNotice): string {
  const matter = notice.matterLabel
    ? matterLedgerLabel(notice.matterCode, notice.matterLabel)
    : notice.matterCode;
  return `${notice.title}. ${notice.body} Matter ${matter}. Ledger entry dated ${notice.postedDate}.`;
}

export function buildPostedNoticeForMatterEvent(input: {
  clientCode: string;
  item: Pick<OfficeItem, "category" | "clientCase" | "details" | "eventDate" | "date" | "filingDeadline">;
  amount: number;
  postedDate: string;
}): PostedLedgerChargeNotice {
  const { category, categoryOther } = splitEventCategory(input.item.category);
  const resolved = resolveEventCategory(category, categoryOther);
  const clientCode = input.clientCode.trim().toUpperCase();
  const clientCase = input.item.clientCase;
  const amount = input.amount;
  const postedDate = input.postedDate;
  const eventDate = input.item.eventDate?.trim() || input.item.date?.trim() || input.item.filingDeadline?.trim();

  if (isHearingEventCategory(resolved)) {
    return buildAppearanceFeePostedNotice({
      clientCode,
      clientCase,
      amount,
      postedDate,
      hearingDate: eventDate,
      hearingLabel: input.item.details
    });
  }

  if (isConsultationEventCategory(resolved)) {
    return buildConsultationFeePostedNotice({
      clientCode,
      clientCase,
      amount,
      postedDate,
      consultationDate: eventDate,
      consultationLabel: input.item.details
    });
  }

  return buildFilingFeePostedNotice({
    clientCode,
    clientCase,
    amount,
    postedDate,
    pleadingLabel: input.item.details
  });
}
