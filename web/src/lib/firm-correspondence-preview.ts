import { buildClientEmailHtml, buildClientEmailPlain } from "@/lib/firm-email-signature";
import {
  buildFirmEmailBodyParagraph,
  buildFirmEmailClosingLine,
  buildFirmEmailGreetingLine,
  buildFirmFormalEmailShell,
  escapeFirmEmailHtml,
  wrapFirmClientEmailDocument
} from "@/lib/firm-email-shell";
import { buildFirmLetterDocumentHtml } from "@/lib/firm-letterhead-html";
import { type FirmPageSize } from "@/lib/firm-page-sizes";
import {
  isRichTextHtml,
  plainTextToEditorHtml,
  richTextToLetterParagraphs,
  sanitizeRichTextHtml
} from "@/lib/rich-text";

export type CorrespondenceKind = "demand" | "proposal" | "reply" | "request" | "general" | "other";

export type CorrespondenceLetterInput = {
  kind: CorrespondenceKind;
  /** Optional document title shown below the salutation — defaults from kind. */
  documentTitle?: string;
  pageSize?: FirmPageSize;
  letterDate: string;
  recipientName: string;
  recipientAddress: string;
  recipientEmail?: string;
  subjectLine?: string;
  salutation?: string;
  body: string;
  closing?: string;
  signatoryName: string;
  signatoryTitle?: string;
  matterReference?: string;
  clientCode?: string;
};

export const CORRESPONDENCE_KIND_LABELS: Record<CorrespondenceKind, string> = {
  demand: "Demand letter",
  proposal: "Proposal for legal services",
  reply: "Reply letter",
  request: "Letter request",
  general: "General correspondence",
  other: "Other / blank"
};

const CORRESPONDENCE_KIND_SLUG: Record<CorrespondenceKind, string> = {
  demand: "Demand",
  proposal: "Proposal",
  reply: "Reply",
  request: "Request",
  general: "Letter",
  other: "Letter"
};

function resolvePageSize(input: CorrespondenceLetterInput): FirmPageSize {
  return input.pageSize ?? "legal";
}

function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function correspondenceDocumentTitle(input: CorrespondenceLetterInput): string {
  const custom = input.documentTitle?.trim();
  if (custom) return custom;
  if (input.kind === "other") return "";
  return CORRESPONDENCE_KIND_LABELS[input.kind];
}

export function correspondenceSalutation(input: Pick<CorrespondenceLetterInput, "recipientName" | "salutation">): string {
  const custom = input.salutation?.trim();
  if (custom) return custom.replace(/,+\s*$/, "");
  const name = input.recipientName.trim();
  return name ? `Dear Sir/Ma'am ${name}` : "Dear Sir/Ma'am";
}

export function correspondenceClosing(input: Pick<CorrespondenceLetterInput, "closing">): string {
  return input.closing?.trim() || "Very truly yours,";
}

export function bodyParagraphs(body: string): string[] {
  if (isRichTextHtml(body)) return richTextToLetterParagraphs(body);
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function buildCorrespondenceBodyContentHtml(body: string): string {
  const inner = isRichTextHtml(body)
    ? sanitizeRichTextHtml(body)
    : bodyParagraphs(body).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  return `<div class="firm-letter-body__content">${inner}</div>`;
}

export function defaultSubjectForKind(kind: CorrespondenceKind, matterReference?: string): string {
  const matter = matterReference?.trim();
  switch (kind) {
    case "demand":
      return matter ? `Demand for payment — ${matter}` : "Demand for payment / compliance";
    case "proposal":
      return matter ? `Proposal for legal representation — ${matter}` : "Proposal for legal representation";
    case "reply":
      return "Re: [Your reference]";
    case "request":
      return matter ? `Request — ${matter}` : "Request for documents / information";
    case "general":
      return matter || "";
    case "other":
      return "";
  }
}

export function defaultBodyForKind(kind: CorrespondenceKind, matterReference?: string): string {
  const matter = matterReference?.trim() || "[matter / client name]";
  switch (kind) {
    case "demand":
      return `We represent our client in the above-captioned matter.

Despite prior reminders, the outstanding balance of {{balance}} remains unpaid. We hereby demand payment within fifteen (15) days from receipt of this letter.

Failure to comply may compel us to pursue available legal remedies without further notice.`;
    case "proposal":
      return `Thank you for consulting our office regarding ${matter}.

We propose to represent you in the above matter. Our professional fees, scope of work, and terms will be confirmed in a formal engagement document upon your acceptance.

Should you wish to proceed, kindly confirm in writing so we may prepare the contract or retainership agreement.`;
    case "reply":
      return `We refer to your letter dated [date] regarding ${matter}.

In reply, please be advised that [state your response here].`;
    case "request":
      return `We act for our client in the above-captioned matter.

May we respectfully request that you provide [documents / information] on or before [date].`;
    case "general":
      return `Good day.

[Your message here.]`;
    case "other":
      return "";
  }
}

function buildCorrespondenceBodyHtml(input: CorrespondenceLetterInput): string {
  const subject = input.subjectLine?.trim();
  const bodyContent = buildCorrespondenceBodyContentHtml(input.body);
  const title = correspondenceDocumentTitle(input);
  const matterRef = input.matterReference?.trim() || input.clientCode?.trim();

  return (
    `<p class="firm-letter-body__date">${escapeHtml(formatLongDate(input.letterDate))}</p>` +
    `<p class="firm-letter-body__client-name">${escapeHtml(input.recipientName.trim() || "Recipient")}</p>` +
    (input.recipientAddress.trim()
      ? `<p class="firm-letter-body__client-address">${input.recipientAddress
          .trim()
          .split("\n")
          .map(escapeHtml)
          .join("<br>")}</p>`
      : `<p class="firm-letter-body__client-address"></p>`) +
    (subject ? `<p><strong>Re: ${escapeHtml(subject)}</strong></p>` : "") +
    `<p>${escapeHtml(correspondenceSalutation(input))},</p>` +
    (title ? `<h1 class="firm-letter-body__title">${escapeHtml(title)}</h1>` : "") +
    bodyContent +
    `<p class="firm-letter-body__closing">${escapeHtml(correspondenceClosing(input))}</p>` +
    `<p style="margin:0.15in 0 0;">${escapeHtml(input.signatoryName.trim() || "Authorized representative")}</p>` +
    (input.signatoryTitle?.trim()
      ? `<p style="margin:0.08in 0 0;">${escapeHtml(input.signatoryTitle.trim())}</p>`
      : "") +
    (matterRef
      ? `<p class="firm-letter-body__matter-ref">Matter reference: ${escapeHtml(matterRef)}</p>`
      : "")
  );
}

function buildCorrespondenceDocumentHtml(input: CorrespondenceLetterInput): string {
  const body = buildCorrespondenceBodyHtml(input);
  const pageSize = resolvePageSize(input);
  const title = escapeHtml(correspondenceDocumentTitle(input));
  const recipient = escapeHtml(input.recipientName.trim() || "Recipient");

  return buildFirmLetterDocumentHtml({
    pageSize,
    title: `${title} — ${recipient}`,
    bodyHtml: body
  });
}

export function buildCorrespondenceLetterHtml(input: CorrespondenceLetterInput): string {
  return buildCorrespondenceDocumentHtml(input);
}

export function buildCorrespondenceEmailPreview(input: CorrespondenceLetterInput): {
  subject: string;
  body: string;
  html: string;
} {
  const docLabel = correspondenceDocumentTitle(input);
  const subjectParts = [docLabel];
  if (input.subjectLine?.trim()) subjectParts.push(input.subjectLine.trim());
  if (input.clientCode?.trim()) subjectParts.push(`(${input.clientCode.trim()})`);
  const subject = subjectParts.join(" — ");

  const salutation = correspondenceSalutation(input);
  const matter = input.subjectLine?.trim() || input.matterReference?.trim() || input.clientCode?.trim() || "the above matter";

  const body = `${salutation},

Good day.

Please find attached our ${docLabel.toLowerCase()} concerning ${matter}.

Kindly acknowledge receipt. Should you have any questions, please do not hesitate to contact our office.

Thank you.`;

  const bodyHtml = buildFirmFormalEmailShell({
    sectionLabel: "Correspondence",
    documentTitle: docLabel,
    innerHtml:
      `<p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#0a0a0a;">${escapeFirmEmailHtml(salutation)},</p>` +
      buildFirmEmailGreetingLine() +
      buildFirmEmailBodyParagraph(
        `Please find attached our <strong>${escapeFirmEmailHtml(docLabel.toLowerCase())}</strong> concerning <strong>${escapeFirmEmailHtml(matter)}</strong>.`
      ) +
      buildFirmEmailBodyParagraph(
        "Kindly acknowledge receipt. Should you have any questions, please do not hesitate to contact our office.",
        { marginBottom: 0 }
      ) +
      buildFirmEmailClosingLine()
  });

  return {
    subject,
    body: buildClientEmailPlain(body),
    html: buildClientEmailHtml(wrapFirmClientEmailDocument(bodyHtml))
  };
}

export function correspondenceLetterFilename(input: CorrespondenceLetterInput): string {
  const kind = CORRESPONDENCE_KIND_SLUG[input.kind];
  const ref = sanitizeFilenamePart(input.clientCode?.trim() || input.recipientName.trim() || "Draft");
  const date = sanitizeFilenamePart(input.letterDate || "Draft");
  return `Letter-${kind}-${ref}-${date}.pdf`;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function defaultCorrespondenceLetterInput(partial?: {
  kind?: CorrespondenceKind;
  recipientName?: string;
  recipientAddress?: string;
  recipientEmail?: string;
  matterReference?: string;
  clientCode?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}): CorrespondenceLetterInput {
  const kind = partial?.kind ?? "general";
  const matterReference = partial?.matterReference?.trim() || partial?.clientCode?.trim() || "";
  const starterBody = defaultBodyForKind(kind, matterReference);
  return {
    kind,
    pageSize: "legal",
    letterDate: new Date().toISOString().slice(0, 10),
    recipientName: partial?.recipientName?.trim() || "",
    recipientAddress: partial?.recipientAddress?.trim() || "",
    recipientEmail: partial?.recipientEmail?.trim() || "",
    subjectLine: defaultSubjectForKind(kind, matterReference),
    body: starterBody ? plainTextToEditorHtml(starterBody) : "",
    signatoryName: partial?.signatoryName?.trim() || "",
    signatoryTitle: partial?.signatoryTitle?.trim() || "Attorney-at-Law",
    matterReference,
    clientCode: partial?.clientCode?.trim() || ""
  };
}
