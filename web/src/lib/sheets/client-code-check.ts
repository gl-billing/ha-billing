import type { SimilarClientMatch } from "@/lib/sheets/client-similarity";
import type { PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";

export type ClientCodeConflict = {
  code: string;
  name: string;
  caseTitle: string;
  inMasterList: boolean;
  hasLedgerTab: boolean;
};

export type ClientCodeCheckResult = {
  codeConflict: ClientCodeConflict | null;
  taskPrefix: string;
  clientCaseLabel: string;
  prefixMatches: PrefixCollisionMatch[];
  similarMatches: SimilarClientMatch[];
};

/** User acknowledgement when intake shows possible conflict warnings. */
export type ConflictReviewChoice = "same_case" | "different_case";

export type CollisionWarningGroups = {
  profileMatches: PrefixCollisionMatch[];
  taskGroupingMatches: PrefixCollisionMatch[];
};

const PROFILE_REASON_MARKERS = [
  "Similar client name",
  "Partial name match",
  "Similar case title",
  "Partial case title match",
  "Same or similar case number",
  "Same court",
  "Same client name and case title",
  "duplicate profile"
];

const TASK_GROUPING_MARKERS = ["task prefix", "tasks may group", "Billing code", "shares prefix"];

export function parseClientCaseLabel(label: string): { clientName: string; caseTitle: string } {
  const raw = label.trim();
  const sep = raw.indexOf(" — ");
  if (sep >= 0) {
    return {
      clientName: raw.slice(0, sep).trim(),
      caseTitle: raw.slice(sep + 3).trim()
    };
  }
  return { clientName: raw, caseTitle: "" };
}

export function clientCodeCheckBlocksCreate(result: ClientCodeCheckResult | null): boolean {
  return Boolean(result?.codeConflict);
}

export function clientCodeCheckHasWarnings(result: ClientCodeCheckResult | null): boolean {
  if (!result) return false;
  return result.prefixMatches.length > 0 || result.similarMatches.length > 0;
}

export function groupCollisionWarnings(result: ClientCodeCheckResult | null): CollisionWarningGroups {
  if (!result) {
    return { profileMatches: [], taskGroupingMatches: [] };
  }

  const profileMatches: PrefixCollisionMatch[] = [];
  const taskGroupingMatches: PrefixCollisionMatch[] = [];

  for (const match of result.prefixMatches) {
    const reasons = match.reasons.join(" · ").toLowerCase();
    const isProfile = PROFILE_REASON_MARKERS.some((marker) => reasons.includes(marker.toLowerCase()));
    const isTask = TASK_GROUPING_MARKERS.some((marker) => reasons.includes(marker.toLowerCase()));

    if (isProfile) profileMatches.push(match);
    if (isTask) taskGroupingMatches.push(match);
    if (!isProfile && !isTask) profileMatches.push(match);
  }

  return { profileMatches, taskGroupingMatches };
}

export function formatCodeConflictMessage(conflict: ClientCodeConflict): string {
  const label = [conflict.name, conflict.caseTitle].filter(Boolean).join(" · ");
  if (conflict.inMasterList && conflict.hasLedgerTab) {
    return `Client code ${conflict.code} is already on Master List${label ? ` (${label})` : ""} and has a ledger tab. Choose a different code.`;
  }
  if (conflict.inMasterList) {
    return `Client code ${conflict.code} is already on Master List${label ? ` (${label})` : ""}. Choose a different code.`;
  }
  return `A ledger tab named ${conflict.code} already exists. Choose a different client code.`;
}

export function collisionBlocksTaskOrEvent(result: ClientCodeCheckResult | null): boolean {
  return clientCodeCheckBlocksCreate(result);
}

export function clientCodeCheckCanProceed(
  result: ClientCodeCheckResult | null,
  review: boolean | ConflictReviewChoice | null
): boolean {
  if (clientCodeCheckBlocksCreate(result)) return false;
  if (!clientCodeCheckHasWarnings(result)) return true;
  if (review === true || review === "different_case") return true;
  return false;
}

export function conflictReviewBlocksProceed(choice: ConflictReviewChoice | null): string | null {
  if (choice === "same_case") {
    return "Same case — use an existing client code from the list instead of creating a new Master List tab.";
  }
  if (!choice) {
    return "Review the possible conflict and choose whether this is the same case or a different case.";
  }
  return null;
}

export function collisionWarningMessage(result: ClientCodeCheckResult | null): string | null {
  if (!result) return null;
  if (result.codeConflict) {
    return `${formatCodeConflictMessage(result.codeConflict)} Tasks and events cannot be saved under a duplicate client code.`;
  }
  if (!clientCodeCheckHasWarnings(result)) return null;
  return "This may collide with an existing client profile or group tasks/events with another matter. Review the warning below before saving.";
}
