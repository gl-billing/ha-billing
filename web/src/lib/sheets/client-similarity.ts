import type { ClientSummary } from "@/lib/gl-config";

export type SimilarClientMatch = {
  code: string;
  name: string;
  caseTitle: string;
  caseNumber: string;
  courtPending: string;
  score: number;
  reasons: string[];
};

function normalize(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((t) => t.length > 2)
  );
}

function overlapScore(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  return shared / Math.max(ta.size, tb.size);
}

function exactOrContains(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function findSimilarClients(
  clients: ClientSummary[],
  input: { clientName?: string; caseTitle?: string; caseNumber?: string; courtPending?: string; clientCode?: string },
  options?: { minScore?: number; limit?: number }
): SimilarClientMatch[] {
  const minScore = options?.minScore ?? 0.45;
  const limit = options?.limit ?? 5;
  const code = input.clientCode?.trim().toUpperCase();

  const matches: SimilarClientMatch[] = [];

  for (const client of clients) {
    if (code && client.code.toUpperCase() === code) continue;

    const reasons: string[] = [];
    let score = 0;
    let identityMatch = false;

    if (input.clientName && exactOrContains(client.name, input.clientName)) {
      score += 0.55;
      identityMatch = true;
      reasons.push("Similar client name");
    } else if (input.clientName) {
      const nameScore = overlapScore(client.name, input.clientName);
      if (nameScore >= 0.5) {
        score += nameScore * 0.5;
        identityMatch = true;
        reasons.push("Partial name match");
      }
    }

    if (input.caseNumber && client.caseNumber && exactOrContains(client.caseNumber, input.caseNumber)) {
      score += 0.7;
      identityMatch = true;
      reasons.push("Same or similar case number");
    }

    // Case title can refine a match — never identify a client profile on its own.
    if (identityMatch && input.caseTitle) {
      if (exactOrContains(client.caseTitle, input.caseTitle)) {
        score += 0.15;
        reasons.push("Same case title");
      } else {
        const caseScore = overlapScore(client.caseTitle, input.caseTitle);
        if (caseScore >= 0.45) {
          score += caseScore * 0.1;
          reasons.push("Similar case title");
        }
      }
    }

    if (
      identityMatch &&
      input.courtPending &&
      client.courtPending &&
      overlapScore(client.courtPending, input.courtPending) >= 0.5
    ) {
      score += 0.25;
      reasons.push("Same court");
    }

    if (score >= minScore) {
      matches.push({
        code: client.code,
        name: client.name,
        caseTitle: client.caseTitle,
        caseNumber: client.caseNumber || "",
        courtPending: client.courtPending || "",
        score: Math.min(1, score),
        reasons: Array.from(new Set(reasons))
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
