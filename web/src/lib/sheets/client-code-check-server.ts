import type { ClientSummary } from "@/lib/gl-config";
import { findSimilarClients } from "@/lib/sheets/client-similarity";
import { findPrefixCollisions, type PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";
import { sheetExists } from "@/lib/sheets/client";
import {
  parseClientCaseLabel,
  type ClientCodeCheckResult,
  type ClientCodeConflict
} from "@/lib/sheets/client-code-check";
import { taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";

function normalizeProfileText(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function findDuplicateProfileMatches(
  clients: ClientSummary[],
  input: { clientName?: string; caseTitle?: string; clientCode?: string }
): PrefixCollisionMatch[] {
  const name = normalizeProfileText(input.clientName || "");
  const caseTitle = normalizeProfileText(input.caseTitle || "");
  const blocked = input.clientCode?.trim().toUpperCase();
  if (!name) return [];

  const matches: PrefixCollisionMatch[] = [];

  for (const client of clients) {
    const code = client.code.trim().toUpperCase();
    if (blocked && code === blocked) continue;

    const existingName = normalizeProfileText(client.name);
    const existingCase = normalizeProfileText(client.caseTitle);
    const sameName = existingName === name;
    const sameCase = caseTitle && existingCase && existingCase === caseTitle;

    if (sameName && sameCase) {
      matches.push({
        code: client.code,
        name: client.name,
        caseTitle: client.caseTitle,
        taskPrefix: taskCodeForBillingClient({
          code: client.code,
          caseTitle: client.caseTitle,
          name: client.name
        }),
        reasons: ["Same client name and case title — may duplicate an existing profile"],
        similarScore: 1
      });
      continue;
    }

    if (sameName && !caseTitle && !existingCase) {
      matches.push({
        code: client.code,
        name: client.name,
        caseTitle: client.caseTitle,
        taskPrefix: taskCodeForBillingClient({
          code: client.code,
          caseTitle: client.caseTitle,
          name: client.name
        }),
        reasons: ["Same client name with no case title — may override an existing profile"],
        similarScore: 0.9
      });
    }
  }

  return matches;
}

/** Codes already on Master List or with a ledger tab cannot be reused for a new profile. */
export async function checkClientCodeForIntake(
  accessToken: string,
  clients: ClientSummary[],
  input: {
    clientCode?: string;
    clientName?: string;
    caseTitle?: string;
    caseNumber?: string;
    courtPending?: string;
  }
): Promise<ClientCodeCheckResult> {
  const clientCode = input.clientCode?.trim().toUpperCase() || "";
  const prefix = findPrefixCollisions(clients, {
    clientCode,
    clientName: input.clientName,
    caseTitle: input.caseTitle
  });

  const similarMatches = findSimilarClients(clients, {
    clientName: input.clientName,
    caseTitle: input.caseTitle,
    caseNumber: input.caseNumber,
    courtPending: input.courtPending,
    clientCode
  });

  let codeConflict: ClientCodeConflict | null = null;

  if (clientCode) {
    const listed = clients.find((row) => row.code.trim().toUpperCase() === clientCode);
    const inMasterList = Boolean(listed);
    const hasLedgerTab = await sheetExists(accessToken, clientCode);

    if (inMasterList || hasLedgerTab) {
      codeConflict = {
        code: listed?.code || clientCode,
        name: listed?.name || "",
        caseTitle: listed?.caseTitle || "",
        inMasterList,
        hasLedgerTab
      };
    }
  }

  const duplicateProfiles = findDuplicateProfileMatches(clients, {
    clientName: input.clientName,
    caseTitle: input.caseTitle,
    clientCode
  });

  const prefixMatches = dedupeWarningMatches(
    [...duplicateProfiles, ...prefix.matches],
    similarMatches,
    codeConflict?.code
  );

  return {
    codeConflict,
    taskPrefix: prefix.taskPrefix,
    clientCaseLabel: prefix.clientCaseLabel,
    prefixMatches,
    similarMatches: similarMatches.filter(
      (match) => match.code.trim().toUpperCase() !== codeConflict?.code?.trim().toUpperCase()
    )
  };
}

/** Check a typed client/case label before saving a task or event (manual entry). */
export async function checkClientCaseLabelForTaskEvent(
  accessToken: string,
  clients: ClientSummary[],
  clientCaseLabel: string
): Promise<ClientCodeCheckResult> {
  const parsed = parseClientCaseLabel(clientCaseLabel);
  return checkClientCodeForIntake(accessToken, clients, {
    clientName: parsed.clientName,
    caseTitle: parsed.caseTitle
  });
}

function dedupeWarningMatches(
  prefixMatches: PrefixCollisionMatch[],
  similar: ReturnType<typeof findSimilarClients>,
  blockedCode?: string
): PrefixCollisionMatch[] {
  const blocked = blockedCode?.trim().toUpperCase();
  const map = new Map<string, PrefixCollisionMatch>();

  for (const match of prefixMatches) {
    const code = match.code.trim().toUpperCase();
    if (blocked && code === blocked) continue;
    map.set(code, match);
  }

  for (const match of similar) {
    const code = match.code.trim().toUpperCase();
    if (blocked && code === blocked) continue;
    if (map.has(code)) continue;
    map.set(code, {
      code: match.code,
      name: match.name,
      caseTitle: match.caseTitle,
      taskPrefix: code.slice(0, 3),
      reasons: match.reasons,
      similarScore: match.score
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.similarScore || 0) - (a.similarScore || 0) || a.code.localeCompare(b.code)
  );
}
