import { formatClientCaseLabel } from "@/lib/gl-config";
import type { ClientSummary } from "@/lib/gl-config";
import { clientCodeFromCase, taskCodeForBillingClient } from "@/lib/office-tasks/client-matter";
import { findSimilarClients, type SimilarClientMatch } from "@/lib/sheets/client-similarity";

export type PrefixCollisionMatch = {
  code: string;
  name: string;
  caseTitle: string;
  taskPrefix: string;
  reasons: string[];
  similarScore?: number;
};

export type PrefixCollisionResult = {
  taskPrefix: string;
  clientCaseLabel: string;
  matches: PrefixCollisionMatch[];
};

function mergeMatch(
  map: Map<string, PrefixCollisionMatch>,
  client: ClientSummary,
  taskPrefix: string,
  reason: string
) {
  const code = client.code.trim().toUpperCase();
  if (!code) return;
  const existing = map.get(code);
  const clientPrefix = taskCodeForBillingClient({
    code: client.code,
    caseTitle: client.caseTitle,
    name: client.name
  });
  if (existing) {
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    return;
  }
  map.set(code, {
    code: client.code,
    name: client.name,
    caseTitle: client.caseTitle,
    taskPrefix: clientPrefix,
    reasons: [reason]
  });
}

/** Detect billing clients that may share task-sheet grouping with a new matter. */
export function findPrefixCollisions(
  clients: ClientSummary[],
  input: { clientCode?: string; clientName?: string; caseTitle?: string }
): PrefixCollisionResult {
  const clientCode = input.clientCode?.trim().toUpperCase() || "";
  const clientName = input.clientName?.trim() || "";
  const caseTitle = input.caseTitle?.trim() || "";
  const clientCaseLabel = formatClientCaseLabel(clientName, caseTitle);
  const taskPrefix = clientCaseLabel ? clientCodeFromCase(clientCaseLabel) : clientCode.slice(0, 3);

  const map = new Map<string, PrefixCollisionMatch>();

  for (const client of clients) {
    const existingCode = client.code.trim().toUpperCase();
    if (!existingCode || (clientCode && existingCode === clientCode)) continue;

    const existingPrefix = taskCodeForBillingClient({
      code: client.code,
      caseTitle: client.caseTitle,
      name: client.name
    });

    if (taskPrefix && existingPrefix === taskPrefix) {
      mergeMatch(
        map,
        client,
        existingPrefix,
        `Same task prefix (${taskPrefix}) — tasks may group together in the office calendar`
      );
    }

    if (taskPrefix.length === 3 && existingCode.startsWith(taskPrefix) && existingCode !== clientCode) {
      mergeMatch(
        map,
        client,
        existingPrefix,
        `Billing code ${existingCode} starts with ${taskPrefix}`
      );
    }

    if (clientCode.length > 3 && existingPrefix === clientCode.slice(0, 3)) {
      mergeMatch(
        map,
        client,
        existingPrefix,
        `Your code ${clientCode} shares prefix ${existingPrefix} with this client`
      );
    }
  }

  const similar = findSimilarClients(clients, {
    clientName,
    caseTitle,
    clientCode
  });

  for (const match of similar) {
    const client = clients.find((row) => row.code.toUpperCase() === match.code.toUpperCase());
    if (!client) continue;
    const entry = map.get(match.code.toUpperCase());
    if (entry) {
      entry.similarScore = match.score;
      for (const reason of match.reasons) {
        if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
      }
    } else {
      map.set(match.code.toUpperCase(), {
        code: client.code,
        name: client.name,
        caseTitle: client.caseTitle,
        taskPrefix: taskCodeForBillingClient({
          code: client.code,
          caseTitle: client.caseTitle,
          name: client.name
        }),
        reasons: [...match.reasons],
        similarScore: match.score
      });
    }
  }

  const matches = Array.from(map.values()).sort(
    (a, b) => (b.similarScore || 0) - (a.similarScore || 0) || a.code.localeCompare(b.code)
  );

  return { taskPrefix, clientCaseLabel, matches };
}

export function formatCollisionSummary(match: PrefixCollisionMatch): string {
  const label = formatClientCaseLabel(match.name, match.caseTitle);
  return `${match.code} — ${label || match.name}`;
}

export function formatSimilarSummary(match: SimilarClientMatch): string {
  return `${match.code} — ${match.name}${match.caseTitle ? ` · ${match.caseTitle}` : ""}`;
}
