import type { SoaStatusReportPayload } from "@/lib/gl-config";
import {
  arEmailSubject,
  buildArEmailHtml,
  buildArEmailPlain,
  buildSoaEmailHtml,
  buildSoaEmailPlain,
  soaEmailSubject
} from "@/lib/billing-email";
import { billingEmailAttachmentNoteHtml } from "@/lib/firm-print-brand";

type ClientEmailGreeting = {
  preferredGreeting?: string;
  clientName?: string;
};

type SoaPreviewInput = ClientEmailGreeting & {
  clientCode: string;
  invoiceNumber?: string;
  totalDue: number;
  statusReport?: SoaStatusReportPayload | null;
  includeStatusReport: boolean;
};

type ArPreviewInput = ClientEmailGreeting & {
  clientCode: string;
  receiptNumber?: string;
  paymentDate: string;
  amount: number;
  method: string;
  details: string;
  paymentFor: string;
  balance: number;
  extraNote?: string;
};

const ATTACHMENT_NOTE_SOA = billingEmailAttachmentNoteHtml("Statement of Account");
const ATTACHMENT_NOTE_AR = billingEmailAttachmentNoteHtml("Acknowledgment Receipt");

const ATTACHMENT_PLAIN = "\n\n---\n[PDF attachment will be included when sent]";

export function buildSoaEmailPreview(input: SoaPreviewInput): {
  subject: string;
  body: string;
  html: string;
} {
  const invoiceNum = input.invoiceNumber || "INV-XXXX";
  const payload = {
    clientCode: input.clientCode,
    invoiceNumber: invoiceNum,
    totalDue: input.totalDue,
    preferredGreeting: input.preferredGreeting,
    clientName: input.clientName,
    includeStatusReport: input.includeStatusReport,
    statusReport: input.statusReport
  };

  return {
    subject: soaEmailSubject(invoiceNum, input.clientCode),
    body: buildSoaEmailPlain(payload) + ATTACHMENT_PLAIN,
    html: buildSoaEmailHtml(payload) + ATTACHMENT_NOTE_SOA
  };
}

export function buildArEmailPreview(input: ArPreviewInput): {
  subject: string;
  body: string;
  html: string;
} {
  const receiptNum = input.receiptNumber || "AR-XXXX";
  const payload = {
    clientCode: input.clientCode,
    receiptNumber: receiptNum,
    paymentDate: input.paymentDate,
    amount: input.amount,
    method: input.method,
    details: input.details,
    paymentFor: input.paymentFor,
    balance: input.balance,
    extraNote: input.extraNote,
    preferredGreeting: input.preferredGreeting,
    clientName: input.clientName
  };

  return {
    subject: arEmailSubject(receiptNum, input.clientCode),
    body: buildArEmailPlain(payload) + ATTACHMENT_PLAIN,
    html: buildArEmailHtml(payload) + ATTACHMENT_NOTE_AR
  };
}
