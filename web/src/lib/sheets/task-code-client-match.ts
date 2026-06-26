import { formatClientCaseLabel } from "@/lib/gl-config";
import { clientCodeFromCase, taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";
import {
  caseTitleTokensFullyInLabel,
  clientNameTokensInLabel
} from "@/lib/office-tasks/client-case-identity";

export type TaskCodeClientRow = {
  code: string;
  name: string;
  caseTitle: string;
  caseNumber?: string;
};

export function rowMatchesTaskCodeLookup(row: TaskCodeClientRow, taskCode: string): boolean {
  const code = taskCode.trim().toUpperCase();
  const rowCode = row.code.trim().toUpperCase();
  if (!code || !rowCode) return false;
  if (rowCode === code) return true;
  if (code.length <= 3) {
    if (rowCode.startsWith(code)) return true;
    const taskPrefix = clientCodeFromCase(formatClientCaseLabel(row.name, row.caseTitle));
    if (taskPrefix === code) return true;
  }
  return false;
}

export function billingClientMatchesMatterCode(
  matterCode: string,
  detail: Pick<TaskCodeClientRow, "code" | "name" | "caseTitle">
): boolean {
  const requested = matterCode.trim().toUpperCase();
  const resolved = detail.code.trim().toUpperCase();
  if (!requested || !resolved) return false;
  if (requested === resolved) return true;
  if (requested.length <= 3 && resolved.startsWith(requested)) return true;
  return taskCodeForBillingClient(detail) === requested;
}

export function scoreClientRowForTaskCode(
  row: TaskCodeClientRow,
  taskCode: string,
  caseHint?: string
): number {
  const code = taskCode.trim().toUpperCase();
  const rowCode = row.code.trim().toUpperCase();
  if (!rowMatchesTaskCodeLookup(row, code)) return 0;

  const taskPrefix = clientCodeFromCase(formatClientCaseLabel(row.name, row.caseTitle));
  let score = rowCode === code ? 100 : rowCode.startsWith(code) ? 60 : 35;
  if (code.length <= 3 && taskPrefix === code) score += 10;

  const hint = (caseHint || "").trim().toLowerCase();
  if (hint) {
    const haystack = [row.name, row.caseTitle, row.caseNumber || "", row.code].join(" ").toLowerCase();
    const nameMatch = clientNameTokensInLabel(row.name, hint);
    const caseMatch = row.caseTitle ? caseTitleTokensFullyInLabel(row.caseTitle, hint) : false;

    if (nameMatch && caseMatch) {
      score += 80;
    } else if (nameMatch && !caseMatch) {
      score -= 25;
    } else if (caseMatch) {
      score += 30;
    }

    if (nameMatch && haystack.includes(hint.toLowerCase())) score += 10;
  }

  return score;
}

/** Pick one Master List row for a tasks prefix / matter URL code. Returns null when ambiguous. */
export function pickBestClientRowForTaskCode(
  rows: TaskCodeClientRow[],
  taskCode: string,
  caseHint?: string
): TaskCodeClientRow | null {
  const code = taskCode.trim().toUpperCase();
  if (!code) return null;

  const hint = (caseHint || "").trim();
  const candidates = rows.filter((row) => rowMatchesTaskCodeLookup(row, code));
  if (!candidates.length) return null;

  const sharedPrefixMatches = candidates.filter((row) => taskCodeForBillingClient(row) === code);
  if (sharedPrefixMatches.length > 1 && !hint) return null;

  if (candidates.length === 1) return candidates[0]!;

  const scored = candidates
    .map((row) => ({ row, score: scoreClientRowForTaskCode(row, code, caseHint) }))
    .filter((entry) => entry.score > 0);

  if (!scored.length) return null;

  if (hint) {
    const identityMatches = scored.filter(
      (entry) =>
        clientNameTokensInLabel(entry.row.name, hint) &&
        (!entry.row.caseTitle?.trim() || caseTitleTokensFullyInLabel(entry.row.caseTitle, hint))
    );
    if (identityMatches.length === 1) return identityMatches[0]!.row;
    if (identityMatches.length > 1) {
      identityMatches.sort((a, b) => b.score - a.score);
      if (identityMatches[0]!.score > identityMatches[1]!.score) return identityMatches[0]!.row;
      return null;
    }

    const nameMatches = scored.filter((entry) => clientNameTokensInLabel(entry.row.name, hint));
    if (nameMatches.length === 1) return nameMatches[0]!.row;
    if (nameMatches.length > 1) {
      nameMatches.sort((a, b) => b.score - a.score);
      if (nameMatches[0]!.score > nameMatches[1]!.score) return nameMatches[0]!.row;
      return null;
    }
  }

  scored.sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code));
  if (scored.length >= 2 && scored[0]!.score === scored[1]!.score) return null;
  return scored[0]!.row;
}
