/** Client-safe external counsel types and matter helpers (no Sheets / next/headers). */

export const EXTERNAL_COUNSEL_ROLES = [
  "Collaborating counsel",
  "Appearing counsel",
  "Of counsel",
  "Opposing counsel",
  "Other"
] as const;

export type ExternalCounselRole = (typeof EXTERNAL_COUNSEL_ROLES)[number];

export type ExternalCounselRecord = {
  id: string;
  name: string;
  firm: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  notes: string;
  active: boolean;
  lastUpdated: string;
  rowNumber: number;
};

export type ExternalCounselWriteInput = {
  name: string;
  firm?: string;
  email?: string;
  phone?: string;
  address?: string;
  role?: string;
  notes?: string;
  active?: boolean;
};

export type CollaboratingCounselDetails = {
  name: string;
  firm: string;
  email: string;
  phone: string;
  address: string;
  role: string;
};

const COUNSEL_SEP = " · ";

export function parseCollaboratingCounsel(value: string | null | undefined): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const parts = raw.includes(COUNSEL_SEP) ? raw.split(COUNSEL_SEP) : raw.split(/[,;]/);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of parts) {
    const name = part.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function formatCollaboratingCounsel(names: string[]): string {
  return parseCollaboratingCounsel(names.join(COUNSEL_SEP)).join(COUNSEL_SEP);
}

export function resolveCollaboratingCounselDetails(
  namesValue: string | null | undefined,
  directory: ExternalCounselRecord[]
): CollaboratingCounselDetails[] {
  const byName = new Map(directory.map((row) => [row.name.toLowerCase(), row]));
  return parseCollaboratingCounsel(namesValue).map((name) => {
    const match = byName.get(name.toLowerCase());
    if (!match) {
      return { name, firm: "", email: "", phone: "", address: "", role: "" };
    }
    return {
      name: match.name,
      firm: match.firm,
      email: match.email,
      phone: match.phone,
      address: match.address,
      role: match.role
    };
  });
}
