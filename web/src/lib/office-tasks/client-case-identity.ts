import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getClientPrefix } from "@/lib/office-tasks/sheets/source-id";

const SOURCE_ID_RE = /^([A-Z]{2,3})-(TASK|EVT)-\d{4}$/;

export function parseClientCodeFromSourceId(id: string): string | null {
  const match = String(id || "")
    .trim()
    .toUpperCase()
    .match(SOURCE_ID_RE);
  return match ? match[1] : null;
}

export function clientCodeFromCase(clientCase: string): string {
  return getClientPrefix(clientCase);
}

/** Split a client/case label into a display name and optional case subtitle. */
export function parseClientCaseDisplay(clientCase?: string): { title: string; subtitle?: string } {
  const label = clientCase?.trim() || "—";
  const parts = label.split(/\s+—\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { title: label };

  const first = parts[0];
  const looksLikeCode = /^[A-Z][A-Z0-9_-]{1,11}$/.test(first);

  if (looksLikeCode && parts.length >= 3) {
    return { title: parts[1], subtitle: parts.slice(2).join(" — ") };
  }
  if (looksLikeCode && parts.length === 2) {
    return { title: parts[1] };
  }
  return { title: parts[0], subtitle: parts.slice(1).join(" — ") };
}

function normalizeCaseLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value: string, minLen = 3): string[] {
  return [...new Set(normalizeCaseLabel(value).split(" ").filter((token) => token.length >= minLen))];
}

function labelWords(normLabel: string): Set<string> {
  return new Set(normLabel.split(" ").filter(Boolean));
}

function tokensMatchAsWords(normLabel: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const words = labelWords(normLabel);
  return tokens.every((token) => words.has(token));
}

/** First segment before " — " when it looks like a Master List / task ID code. */
export function parseExplicitLabelCode(raw: string): string | null {
  const first = raw.split(/\s+—\s+/)[0]?.trim() || "";
  if (/^[A-Z][A-Z0-9_-]{1,11}$/i.test(first)) return first.toUpperCase();
  return null;
}

export function caseTitleTokensFullyInLabel(caseTitle: string, clientCaseLabel: string): boolean {
  const caseTokens = significantTokens(caseTitle);
  if (!caseTokens.length) return false;
  return tokensMatchAsWords(normalizeCaseLabel(clientCaseLabel), caseTokens);
}

export function clientNameTokensInLabel(clientName: string, clientCaseLabel: string): boolean {
  const nameTokens = significantTokens(clientName);
  if (!nameTokens.length) return false;
  return tokensMatchAsWords(normalizeCaseLabel(clientCaseLabel), nameTokens);
}

function normalizeCaseNumber(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(case|civil|criminal)\s*(no\.?|number)?\s*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Extract normalized docket numbers mentioned in a client/case label. */
export function extractCaseNumbers(label: string): string[] {
  const raw = String(label || "");
  const matches = raw.match(/\b(?:case|civil|criminal)?\s*no\.?\s*([A-Za-z0-9][A-Za-z0-9-/.]*)/gi) || [];
  const fromPattern = matches
    .map((match) => normalizeCaseNumber(match.replace(/^.*?\bno\.?\s*/i, "")))
    .filter(Boolean);
  return [...new Set(fromPattern)];
}

export function caseNumbersAlign(
  billingCaseNumber: string | undefined,
  clientCaseLabel: string
): boolean {
  const billingNum = normalizeCaseNumber(billingCaseNumber || "");
  if (!billingNum) return true;

  const labelNums = extractCaseNumbers(clientCaseLabel);
  if (!labelNums.length) return true;

  return labelNums.some((labelNum) => labelNum === billingNum || labelNum.includes(billingNum) || billingNum.includes(labelNum));
}

export function caseTitlesAlign(billingCaseTitle: string, labelCasePart: string): boolean {
  const billing = billingCaseTitle.trim();
  const label = labelCasePart.trim();
  if (!billing || !label) return false;
  if (normalizeCaseLabel(billing) === normalizeCaseLabel(label)) return true;
  if (caseTitleTokensFullyInLabel(billing, label)) return true;
  if (caseTitleTokensFullyInLabel(label, billing)) return true;
  return false;
}

const SCHEDULING_SUBTITLE_WORDS = new Set([
  "hearing",
  "filing",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "prep",
  "follow",
  "court",
  "deadline",
  "today",
  "tomorrow"
]);

/** Label subtitle looks like a case caption fragment, not generic scheduling text. */
export function labelSubtitleLooksLikeCaseCaption(subtitle: string): boolean {
  const value = subtitle.trim();
  if (!value) return false;
  if (/\bvs\.?\b/i.test(value)) return true;
  if (/\bet\s+al\.?\b/i.test(value)) return true;

  const tokens = significantTokens(value);
  if (!tokens.length) return false;

  const nonScheduling = tokens.filter((token) => !SCHEDULING_SUBTITLE_WORDS.has(token));
  if (!nonScheduling.length) return false;

  if (nonScheduling.length <= 2 && nonScheduling.every((token) => token.length >= 3 && token.length <= 8)) {
    return true;
  }

  return nonScheduling.length >= 2;
}

export function labelCaseCaptionConflictsWithBilling(
  clientCaseLabel: string,
  billing: { caseTitle?: string }
): boolean {
  const billingCaseTitle = billing.caseTitle?.trim() || "";
  if (!billingCaseTitle) return false;

  const parsed = parseClientCaseDisplay(clientCaseLabel);
  const subtitle = parsed.subtitle?.trim() || "";
  const title = parsed.title.trim();
  if (/\bvs\.?\b/i.test(title) && caseTitlesAlign(billingCaseTitle, title)) return false;
  if (!subtitle) return false;
  if (caseTitlesAlign(billingCaseTitle, subtitle)) return false;
  return labelSubtitleLooksLikeCaseCaption(subtitle);
}

/** Label includes a case caption (vs / et al. / opponent shorthand) — not just client name + scheduling text. */
export function labelExpressesCaseCaption(clientCaseLabel: string): boolean {
  const raw = clientCaseLabel.trim();
  if (!raw) return false;
  if (/\bvs\.?\b/i.test(raw)) return true;

  const parsed = parseClientCaseDisplay(raw);
  if (parsed.subtitle?.trim() && labelSubtitleLooksLikeCaseCaption(parsed.subtitle)) return true;

  return false;
}

export function inferCaseDiscriminatorFromBillingCode(code: string): string | undefined {
  const trimmed = code.trim().toUpperCase();
  const dash = trimmed.indexOf("-");
  if (dash <= 0 || dash >= trimmed.length - 1) return undefined;
  const suffix = trimmed.slice(dash + 1).trim();
  if (!suffix || suffix.length < 3) return undefined;
  return suffix.replace(/_/g, " ");
}

/**
 * Threefold identity: same client name, same case title, same case number when available.
 * Used when deciding whether a tasks-sheet label belongs on a billing matter page.
 */
export function clientCaseIdentityMatchesBilling(
  detail: { name?: string; caseTitle?: string; caseNumber?: string },
  clientCaseLabel: string
): boolean {
  const raw = clientCaseLabel.trim();
  if (!raw) return false;

  const parsed = parseClientCaseDisplay(raw);
  const labelName = parsed.title.trim();
  const labelCasePart = parsed.subtitle?.trim() || "";
  const labelCaseTitlePart = labelCasePart
    .replace(/\s*—?\s*(?:case|civil|criminal)?\s*no\.?\s*[A-Za-z0-9][A-Za-z0-9-/.]*/i, "")
    .trim();

  if (!detail.name?.trim()) return false;
  if (!clientNameMatchesBillingLabel(detail.name, parsed, raw)) return false;

  if (detail.caseTitle?.trim()) {
    const caseTitleMatches =
      (labelCaseTitlePart && caseTitlesAlign(detail.caseTitle, labelCaseTitlePart)) ||
      (/\bvs\.?\b/i.test(labelName) && caseTitlesAlign(detail.caseTitle, labelName));
    if (!caseTitleMatches) return false;
  }

  if (!caseNumbersAlign(detail.caseNumber, raw)) return false;

  return true;
}

/** Client name must appear on the label — not just a shared surname inside an unrelated caption. */
function clientNameMatchesBillingLabel(
  billingName: string,
  parsed: { title: string; subtitle?: string },
  raw: string
): boolean {
  if (clientNameTokensInLabel(billingName, parsed.title)) return true;
  if (clientNameTokensInLabel(billingName, raw)) return true;

  const caption = /\bvs\.?\b/i.test(parsed.title)
    ? parsed.title
    : parsed.subtitle && labelSubtitleLooksLikeCaseCaption(parsed.subtitle)
      ? parsed.subtitle
      : "";
  if (!caption) return false;

  const nameTokens = significantTokens(billingName);
  const surname = nameTokens[nameTokens.length - 1];
  if (!surname) return false;
  return tokensMatchAsWords(normalizeCaseLabel(caption), [surname]);
}

const CRIME_TITLE_WORDS = new Set([
  "qualified",
  "theft",
  "parricide",
  "murder",
  "homicide",
  "estafa",
  "rape",
  "robbery",
  "injury",
  "fraud",
  "criminal",
  "administrative",
  "civil"
]);

function firstSegmentLooksLikeCrimeTitle(first: string): boolean {
  return significantTokens(first).some((token) => CRIME_TITLE_WORDS.has(token));
}

export function labelLeadingSegmentLooksLikeCaseTitle(label: string): boolean {
  const raw = label.trim();
  if (!raw) return false;
  if (parseExplicitLabelCode(raw)) return false;

  const parts = raw.split(/\s+—\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return true;

  const first = parts[0];
  if (significantTokens(first).length === 1) return false;
  if (/\bvs\.?\b/i.test(first)) return false;

  return firstSegmentLooksLikeCrimeTitle(first);
}

/** Two sheet rows refer to the same client — never by shared crime/case title alone. */
export function officeItemsShareClientCaseLabel(
  a: Pick<OfficeItem, "id" | "clientCase">,
  b: Pick<OfficeItem, "id" | "clientCase">
): boolean {
  const left = a.clientCase?.trim() || "";
  const right = b.clientCase?.trim() || "";
  if (!left || !right) return false;

  if (normalizeCaseLabel(left) === normalizeCaseLabel(right)) {
    if (labelLeadingSegmentLooksLikeCaseTitle(left)) {
      const leftId = parseClientCodeFromSourceId(a.id);
      const rightId = parseClientCodeFromSourceId(b.id);
      return Boolean(leftId && rightId && leftId === rightId);
    }
    return true;
  }

  const leftCode = parseExplicitLabelCode(left);
  const rightCode = parseExplicitLabelCode(right);
  if (leftCode && rightCode && leftCode === rightCode) return true;

  const leftFirst = left.split(/\s+—\s+/)[0]?.trim() || "";
  const rightFirst = right.split(/\s+—\s+/)[0]?.trim() || "";
  if (!leftFirst || !rightFirst || normalizeCaseLabel(leftFirst) !== normalizeCaseLabel(rightFirst)) {
    return false;
  }

  if (labelLeadingSegmentLooksLikeCaseTitle(left) || labelLeadingSegmentLooksLikeCaseTitle(right)) {
    return false;
  }

  const namePrefix = clientCodeFromCase(leftFirst).toUpperCase();
  const leftId = parseClientCodeFromSourceId(a.id);
  const rightId = parseClientCodeFromSourceId(b.id);
  if (leftId && rightId && leftId === rightId && leftId === namePrefix) return true;

  return false;
}
