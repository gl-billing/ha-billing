/** Canonical staff / attorney names from the Employees sheet roster. */

import { FIRM_COPYRIGHT_HOLDER } from "@/lib/firm-brand";

function normalizeForMatch(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^atty\.?\s*/i, "")
    .replace(/\s+/g, " ");
}

function lastName(name: string): string {
  const parts = normalizeForMatch(name).split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function splitAssigneeParts(value: string): string[] {
  return String(value || "")
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Placeholder assignees that belong to the firm owner (Atty. Maria Hernandez). */
export function isOwnerAdminAssigneeAlias(input: string): boolean {
  const compact = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!compact || compact === "unassigned") return false;
  if (compact === "admin" || compact === "owner") return true;
  return /^owners?\/?admins?$/.test(compact);
}

/** Resolve the Employees-sheet name for the firm owner / admin. */
export function resolveFirmOwnerAssignee(roster: string[]): string | null {
  if (!roster.length) return null;

  const exact = roster.find((name) => name.toLowerCase() === FIRM_COPYRIGHT_HOLDER.toLowerCase());
  if (exact) return exact;

  const ownerMatches = roster.filter((name) => {
    const norm = normalizeForMatch(name);
    return norm.includes("maria") && norm.includes("hernandez");
  });
  if (ownerMatches.length === 1) return ownerMatches[0];
  if (ownerMatches.length > 1) {
    const withAtty = ownerMatches.find((name) => /^atty/i.test(name.trim()));
    return withAtty || ownerMatches[0];
  }

  const hernandezAtty = roster.filter((name) => {
    const norm = normalizeForMatch(name);
    return norm.includes("hernandez") && /^atty/i.test(name.trim());
  });
  if (hernandezAtty.length === 1) return hernandezAtty[0];

  return null;
}

/** Map a typed name to the roster entry when it clearly refers to the same person. */
export function canonicalizeStaffName(input: string, roster: string[]): string {
  const raw = String(input || "").trim();
  if (!raw || raw.toLowerCase() === "unassigned") return raw;
  if (!roster.length) return raw;

  if (isOwnerAdminAssigneeAlias(raw)) {
    const owner = resolveFirmOwnerAssignee(roster);
    if (owner) return owner;
  }

  const exact = roster.find((name) => name.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const inputNorm = normalizeForMatch(raw);
  if (!inputNorm) return raw;

  const byLast = roster.filter((name) => lastName(name) === lastName(raw));
  if (byLast.length === 1) return byLast[0];

  const byContains = roster.filter((name) => {
    const rosterNorm = normalizeForMatch(name);
    return rosterNorm.includes(inputNorm) || inputNorm.includes(rosterNorm);
  });
  if (byContains.length === 1) return byContains[0];

  const nicknameMatchers: Array<{
    test: (value: string) => boolean;
    rosterMatch: (rosterNorm: string) => boolean;
  }> = [
    { test: (value) => /^jas$/i.test(value) || /^hakola$/i.test(value), rosterMatch: (n) => (n.includes("james") && n.includes("bryan")) || n.includes("hakola") },
    {
      test: (value) => /^(andrea|ellyza)$/i.test(value),
      rosterMatch: (n) => n.includes("andrea") || n.includes("ellyza")
    },
    { test: (value) => /^nikki$/i.test(value), rosterMatch: (n) => n.includes("nikki") },
    {
      test: (value) => /^maria$/i.test(value) || /^atty\.?\s*maria$/i.test(value),
      rosterMatch: (n) => n.includes("maria") && n.includes("hernandez")
    }
  ];

  for (const { test, rosterMatch } of nicknameMatchers) {
    if (!test(raw)) continue;
    const matches = roster.filter((name) => rosterMatch(normalizeForMatch(name)));
    if (matches.length === 1) return matches[0];
  }

  return raw;
}

/** Canonicalize comma-separated assignees (tasks, events). */
export function canonicalizeStaffAssignees(value: string, roster: string[]): string {
  const parts = splitAssigneeParts(value);
  if (!parts.length) return String(value || "").trim();
  return parts.map((part) => canonicalizeStaffName(part, roster)).join(", ");
}
