/**
 * Philippine civil e-filing email helpers — A.M. 10-3-7-SC / A.M. No. 11-9-4-SC
 * (Guidelines on Submission of Electronic Copies of Pleadings).
 */

import { FIRM_EMAIL, FIRM_LANDLINE, FIRM_LINE, FIRM_MOBILE } from "@/lib/billing-document-design";

export type CivilEFilingManner =
  | "Personal Filing"
  | "Registered Mail"
  | "Accredited Courier"
  | "Electronic Filing"
  | "Electronic Transmittal";

export type CivilEFilingAttachmentSpec = {
  /** Display title in the email body list (e.g. "Reply to the Rejoinder"). */
  title: string;
  /** Annex letter/number when this file is an annex (e.g. "A", "1"). */
  annex?: string;
  /** Nested annex lines under a main pleading (body list only). */
  annexTitles?: string[];
};

export type CivilEFilingInput = {
  docketNumber: string;
  caseTitle: string;
  pleadingDesignation: string;
  /** Court / branch for the Clerk of Court address block. */
  courtPending: string;
  /** e.g. "Defendants - Jane Doe … c/o Hernandez & Associates" */
  filingPartyName: string;
  contactNumbers?: string;
  otherEmail?: string;
  primaryManner: CivilEFilingManner | string;
  filingDate: string;
  attachments: CivilEFilingAttachmentSpec[];
  /** Party against whom relief is sought (optional narrative detail). */
  opposingParty?: string;
  /** Nature of relief sought (optional narrative detail). */
  reliefSought?: string;
};

const MANNER_ALIASES: Array<{ match: RegExp; label: CivilEFilingManner }> = [
  { match: /electronic\s*transmittal/i, label: "Electronic Transmittal" },
  { match: /e[\s-]?fil|electronic/i, label: "Electronic Filing" },
  { match: /registered\s*mail/i, label: "Registered Mail" },
  { match: /courier|accredited/i, label: "Accredited Courier" },
  { match: /personal/i, label: "Personal Filing" }
];

export function normalizeCivilEFilingManner(raw: string | undefined | null): CivilEFilingManner {
  const text = String(raw || "").trim();
  if (!text) return "Electronic Filing";
  for (const row of MANNER_ALIASES) {
    if (row.match.test(text)) return row.label;
  }
  return "Electronic Filing";
}

export function isInitiatoryPleading(pleadingType: string | undefined | null): boolean {
  return /initiatory/i.test(String(pleadingType || ""));
}

/** Subject: Docket Number/s, Case Title - Designation of the Pleading */
export function buildCivilEFilingSubject(input: Pick<CivilEFilingInput, "docketNumber" | "caseTitle" | "pleadingDesignation">): string {
  const docket = String(input.docketNumber || "").trim();
  const title = String(input.caseTitle || "").trim();
  const pleading = String(input.pleadingDesignation || "").trim();
  const left = [docket, title].filter(Boolean).join(", ");
  if (!left) return pleading || "Court submission";
  if (!pleading) return left;
  return `${left} - ${pleading}`;
}

/** Main pleading PDF: `{Pleading}-{Docket}.pdf` */
export function buildCivilEFilingMainFilename(pleadingDesignation: string, docketNumber: string): string {
  const pleading = sanitizeFilenamePart(pleadingDesignation) || "Pleading";
  const docket = sanitizeFilenamePart(docketNumber) || "Case";
  return `${pleading}-${docket}.pdf`;
}

/** Annex PDF: `Annex A- {Pleading}-{Docket}.pdf` */
export function buildCivilEFilingAnnexFilename(
  annexLabel: string,
  pleadingDesignation: string,
  docketNumber: string
): string {
  const annex = sanitizeFilenamePart(annexLabel) || "A";
  const pleading = sanitizeFilenamePart(pleadingDesignation) || "Pleading";
  const docket = sanitizeFilenamePart(docketNumber) || "Case";
  const prefixed = /^annex\b/i.test(annex) ? annex : `Annex ${annex}`;
  return `${prefixed}- ${pleading}-${docket}.pdf`;
}

export function buildCivilEFilingFilename(spec: CivilEFilingAttachmentSpec, docketNumber: string, pleadingDesignation: string): string {
  if (spec.annex?.trim()) {
    return buildCivilEFilingAnnexFilename(spec.annex.trim(), pleadingDesignation || spec.title, docketNumber);
  }
  return buildCivilEFilingMainFilename(spec.title || pleadingDesignation, docketNumber);
}

/** Letter annexes (A, B…) for petitioner / plaintiff / private complainant; numbered (1, 2…) for defendant / accused / respondent. */
export type CivilEFilingAnnexStyle = "letter" | "number";

export function resolveCivilEFilingAnnexStyle(caseRole: string | undefined | null): CivilEFilingAnnexStyle {
  const role = String(caseRole || "").trim().toLowerCase();
  if (/defendant|accused|respondent/.test(role)) return "number";
  if (/petitioner|plaintiff|private\s*complainant/.test(role)) return "letter";
  // Default to letter (common for initiatory / complainant-side filings).
  return "letter";
}

function isPrimaryAnnexLabel(label: string, style: CivilEFilingAnnexStyle): boolean {
  const t = label.trim();
  if (style === "letter") return /^[A-Z]$/i.test(t);
  return /^\d+$/.test(t);
}

function primaryAnnexLabels(existing: string[], style: CivilEFilingAnnexStyle): string[] {
  return existing.map((l) => l.trim()).filter((l) => isPrimaryAnnexLabel(l, style));
}

/** Next primary annex: A→B or 1→2. */
export function nextPrimaryAnnexLabel(existingLabels: string[], style: CivilEFilingAnnexStyle): string {
  const primaries = primaryAnnexLabels(existingLabels, style);
  if (style === "letter") {
    const used = new Set(primaries.map((l) => l.toUpperCase()));
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i); // A–Z
      if (!used.has(letter)) return letter;
    }
    return "Z";
  }
  let max = 0;
  for (const p of primaries) {
    const n = Number(p);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

/**
 * Next sub-annex under a primary:
 * letter style → A-1, A-2…
 * number style → 1-A, 1-B…
 */
export function nextSubAnnexLabel(
  primaryLabel: string,
  existingLabels: string[],
  style: CivilEFilingAnnexStyle
): string {
  const primary = primaryLabel.trim();
  if (style === "letter") {
    const re = new RegExp(`^${escapeRegExp(primary)}-(\\d+)$`, "i");
    let max = 0;
    for (const label of existingLabels) {
      const m = label.trim().match(re);
      if (m) max = Math.max(max, Number(m[1]) || 0);
    }
    return `${primary.toUpperCase()}-${max + 1}`;
  }
  const re = new RegExp(`^${escapeRegExp(primary)}-([A-Z])$`, "i");
  const used = new Set<string>();
  for (const label of existingLabels) {
    const m = label.trim().match(re);
    if (m) used.add(m[1].toUpperCase());
  }
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return `${primary}-${letter}`;
  }
  return `${primary}-Z`;
}

export function formatAnnexDisplayLabel(annexLabel: string): string {
  const t = annexLabel.trim();
  if (!t) return "Annex";
  return /^annex\b/i.test(t) ? t : `Annex ${t}`;
}

export function defaultCivilEFilingContactNumbers(): string {
  const landline = FIRM_LANDLINE.replace(/\s+/g, " ").trim();
  const mobile = FIRM_MOBILE.replace(/\s+/g, " ").trim();
  if (landline && mobile) return `${landline} - landline / ${mobile} (mobile)`;
  return landline || mobile || "";
}

export function buildFilingPartyName(input: {
  caseRole?: string;
  clientName?: string;
  firmLine?: string;
}): string {
  const role = String(input.caseRole || "").trim();
  const name = String(input.clientName || "").trim();
  const firm = String(input.firmLine || FIRM_LINE).trim();
  const party = [role, name].filter(Boolean).join(" - ");
  if (!party) return firm ? `c/o ${firm}` : "";
  return firm ? `${party} c/o ${firm}` : party;
}

/** Split courtPending into Clerk of Court address lines. */
export function clerkOfCourtAddressLines(courtPending: string): string[] {
  const raw = String(courtPending || "").trim();
  if (!raw) return ["The Clerk of Court"];
  const parts = raw
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 1) {
    return ["The Clerk of Court", parts[0]];
  }
  return ["The Clerk of Court", ...parts];
}

function formatFilingDateDisplay(isoOrText: string): string {
  const raw = String(isoOrText || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
  }
  return raw;
}

function attachmentBodyLines(attachments: CivilEFilingAttachmentSpec[]): string[] {
  const lines: string[] = [];
  let index = 0;
  for (const att of attachments) {
    if (att.annex?.trim()) continue;
    index += 1;
    const title = att.title.trim() || `Attachment ${index}`;
    lines.push(`${index}. ${title}`);
    for (const nested of att.annexTitles || []) {
      const label = nested.trim();
      if (label) lines.push(label);
    }
  }
  // Standalone annexes not nested under a main pleading
  for (const att of attachments) {
    if (!att.annex?.trim()) continue;
    const annex = att.annex.trim();
    const title = att.title.trim();
    const prefixed = /^annex\b/i.test(annex) ? annex : `Annex ${annex}`;
    lines.push(title ? `${prefixed} - ${title}` : prefixed);
  }
  return lines;
}

const COMPLIANCE_TITLE =
  "Guidelines on Submission of Electronic Copies of Pleadings and Other Court Submissions Being Filed Before the Lower Courts Pursuant to the Efficient Use of Paper Rule";
const COMPLIANCE_CITATION = "A.M. No. 10-3-7-SC / A.M. No. 11-9-4-SC";

/** Counsel line for the opening paragraph — prefer party names without a trailing “c/o firm”. */
export function counselForPartyPhrase(filingPartyName: string, firmLine = FIRM_LINE): string {
  const firm = firmLine.trim();
  let party = filingPartyName.trim() || "the filing party";
  if (firm) {
    const co = new RegExp(`\\s*c\\/o\\s+${escapeRegExp(firm)}\\s*$`, "i");
    party = party.replace(co, "").trim() || party;
  }
  return `${firm || "Undersigned counsel"}, as counsel for ${party}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ParticularRow = { letter: string; label: string; value: string };

function buildParticularRows(input: CivilEFilingInput): ParticularRow[] {
  const manner = normalizeCivilEFilingManner(input.primaryManner);
  const filingDate = formatFilingDateDisplay(input.filingDate);
  const contact = input.contactNumbers?.trim() || defaultCivilEFilingContactNumbers();
  const otherEmail = input.otherEmail?.trim() || FIRM_EMAIL;

  return [
    { letter: "a", label: "Primary manner of filing", value: manner },
    { letter: "b", label: "Filing date", value: filingDate },
    { letter: "c", label: "Docket No.", value: input.docketNumber.trim() },
    { letter: "d", label: "Case title", value: input.caseTitle.trim() },
    { letter: "e", label: "Name of filing party", value: input.filingPartyName.trim() },
    { letter: "f", label: "Contact number/s of the filer", value: contact },
    { letter: "g", label: "Other e-mail address of the filer, if any", value: otherEmail },
    { letter: "h", label: "Title/s of attachment/s", value: "" }
  ];
}

function resolvedAttachmentLines(input: CivilEFilingInput): string[] {
  const pleading = input.pleadingDesignation.trim() || "court submission";
  const attachLines = attachmentBodyLines(input.attachments);
  if (!attachLines.length && pleading) attachLines.push(`1. ${pleading}`);
  return attachLines;
}

export function buildCivilEFilingPlainBody(input: CivilEFilingInput): string {
  const address = clerkOfCourtAddressLines(input.courtPending);
  const pleading = input.pleadingDesignation.trim() || "court submission";
  const docket = input.docketNumber.trim();
  const counsel = counselForPartyPhrase(input.filingPartyName);
  const rows = buildParticularRows(input);
  const attachLines = resolvedAttachmentLines(input);

  const intro = [
    `In compliance with the Supreme Court Resolution dated 11 April 2023 entitled “${COMPLIANCE_TITLE}” (${COMPLIANCE_CITATION}),`,
    `${counsel} respectfully submits the electronic (PDF) copy of the ${pleading}${docket ? ` in ${docket}` : ""}, together with the corresponding attachments hereto.`
  ].join(" ");

  const particularLines = rows.map((row) => {
    if (row.letter === "h") return `(${row.letter}.) ${row.label}:`;
    return `(${row.letter}.) ${row.label}:\t${row.value}`;
  });

  const narrative: string[] = [];
  if (input.opposingParty?.trim()) {
    narrative.push(`Party/parties against whom relief is sought:\t${input.opposingParty.trim()}`);
  }
  if (input.reliefSought?.trim()) {
    narrative.push(`Nature of the relief sought:\t${input.reliefSought.trim()}`);
  }

  return [
    ...address,
    "",
    "Dear Sir/Madam:",
    "",
    "Greetings!",
    "",
    intro,
    "",
    "The following are the particulars of the instant electronic filing:",
    "",
    ...particularLines,
    ...attachLines.map((line) => `     ${line}`),
    ...(narrative.length ? ["", ...narrative] : []),
    "",
    "We respectfully request acknowledgment of receipt of this electronic transmittal.",
    "",
    "Thank you for your kind attention.",
    "",
    "Respectfully submitted,"
  ].join("\n");
}

export function buildCivilEFilingHtmlBody(input: CivilEFilingInput): string {
  const address = clerkOfCourtAddressLines(input.courtPending);
  const pleading = input.pleadingDesignation.trim() || "court submission";
  const docket = input.docketNumber.trim();
  const counsel = counselForPartyPhrase(input.filingPartyName);
  const rows = buildParticularRows(input);
  const attachLines = resolvedAttachmentLines(input);

  const addressHtml = address.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  const particularRowsHtml = rows
    .filter((row) => row.letter !== "h")
    .map(
      (row) => `<tr>
  <td style="padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap;color:#4a453d;">(${escapeHtml(row.letter)}.)</td>
  <td style="padding:4px 16px 4px 0;vertical-align:top;color:#4a453d;width:42%;">${escapeHtml(row.label)}</td>
  <td style="padding:4px 0;vertical-align:top;color:#1a1814;font-weight:500;">${escapeHtml(row.value)}</td>
</tr>`
    )
    .join("");

  const attachmentsHtml = attachLines
    .map(
      (line) =>
        `<div style="margin:0 0 4px;padding-left:1.1em;text-indent:-1.1em;color:#1a1814;">${escapeHtml(line)}</div>`
    )
    .join("");

  const narrativeHtml: string[] = [];
  if (input.opposingParty?.trim()) {
    narrativeHtml.push(
      `<p style="margin:14px 0 0;"><span style="color:#4a453d;">Party/parties against whom relief is sought:</span> ${escapeHtml(input.opposingParty.trim())}</p>`
    );
  }
  if (input.reliefSought?.trim()) {
    narrativeHtml.push(
      `<p style="margin:8px 0 0;"><span style="color:#4a453d;">Nature of the relief sought:</span> ${escapeHtml(input.reliefSought.trim())}</p>`
    );
  }

  return `<div style="margin:0;padding:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;line-height:1.65;color:#1a1814;background:#ffffff;">
  <div style="max-width:640px;">
    <div style="margin:0 0 22px;font-size:15px;line-height:1.45;color:#1a1814;">
      ${addressHtml}
    </div>
    <p style="margin:0 0 18px;">Dear Sir/Madam:</p>
    <p style="margin:0 0 18px;">Greetings!</p>
    <p style="margin:0 0 18px;text-align:justify;">
      In compliance with the Supreme Court Resolution dated 11 April 2023 entitled
      <em>“${escapeHtml(COMPLIANCE_TITLE)}”</em>
      (${escapeHtml(COMPLIANCE_CITATION)}),
      ${escapeHtml(counsel)} respectfully submits the electronic (PDF) copy of the
      <strong>${escapeHtml(pleading)}</strong>${docket ? ` in <strong>${escapeHtml(docket)}</strong>` : ""},
      together with the corresponding attachments hereto.
    </p>
    <p style="margin:0 0 10px;">The following are the particulars of the instant electronic filing:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:14.5px;">
      ${particularRowsHtml}
    </table>
    <p style="margin:12px 0 6px;color:#4a453d;">(h.) Title/s of attachment/s:</p>
    <div style="margin:0 0 18px;">
      ${attachmentsHtml || `<div style="padding-left:1.1em;">1. ${escapeHtml(pleading)}</div>`}
    </div>
    ${narrativeHtml.join("")}
    <p style="margin:22px 0 0;">We respectfully request acknowledgment of receipt of this electronic transmittal.</p>
    <p style="margin:10px 0 0;">Thank you for your kind attention.</p>
    <p style="margin:28px 0 0;">Respectfully submitted,</p>
  </div>
</div>`;
}

function sanitizeFilenamePart(value: string): string {
  return String(value || "")
    .replace(/[/\\?%*:|"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
