import { DEFAULT_FIRM_LAWYERS_ROSTER, MANAGING_PARTNER } from "@/lib/firm-team-config";

export const FIRM_LAWYERS_ROSTER_SETTING_KEY = "Firm Lawyers Roster";

export type FirmLawyerRosterEntry = {
  id: string;
  /** e.g. Atty. Maria Hernandez */
  displayName: string;
  /** Optional label shown in payroll roster — e.g. Founding / Managing Partner */
  designation?: string;
  email: string;
  /** Share of attributed appearance fees (for admin reporting). 0–100. */
  feeSharePercent: number;
  /** When true, synced to the Office Tasks Employees sheet for assignments & oversight. */
  overseesTasks: boolean;
  active: boolean;
};

export function slugifyFirmLawyerId(displayName: string): string {
  const base = String(displayName || "")
    .trim()
    .toLowerCase()
    .replace(/^atty\.?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `atty-${base}` : "atty";
}

export function ensureUniqueFirmLawyerId(
  displayName: string,
  roster: FirmLawyerRosterEntry[],
  excludeId?: string
): string {
  const base = slugifyFirmLawyerId(displayName);
  let candidate = base;
  let n = 2;
  while (roster.some((entry) => entry.id === candidate && entry.id !== excludeId)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export function normalizeFirmLawyerDisplayName(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  if (/^atty/i.test(trimmed)) return trimmed;
  return `Atty. ${trimmed}`;
}

function normalizeEntry(raw: Partial<FirmLawyerRosterEntry>): FirmLawyerRosterEntry | null {
  const displayName = normalizeFirmLawyerDisplayName(String(raw.displayName ?? ""));
  if (!displayName) return null;

  const feeSharePercent = Number(raw.feeSharePercent);
  const share =
    Number.isFinite(feeSharePercent) && feeSharePercent >= 0 && feeSharePercent <= 100
      ? Math.round(feeSharePercent * 100) / 100
      : 100;

  return {
    id: String(raw.id ?? "").trim() || slugifyFirmLawyerId(displayName),
    displayName,
    designation: String(raw.designation ?? "").trim() || undefined,
    email: String(raw.email ?? "").trim(),
    feeSharePercent: share,
    overseesTasks: raw.overseesTasks !== false,
    active: raw.active !== false
  };
}

export function parseFirmLawyersRoster(raw: string | undefined | null): FirmLawyerRosterEntry[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as Partial<FirmLawyerRosterEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is FirmLawyerRosterEntry => entry !== null);
  } catch {
    return [];
  }
}

export function activeFirmLawyersRoster(roster: FirmLawyerRosterEntry[]): FirmLawyerRosterEntry[] {
  return roster.filter((entry) => entry.active !== false && entry.displayName.trim());
}

/** True when the roster row is Atty. Robert Hernandez (managing / founding partner). */
export function isManagingPartnerRosterEntry(entry: FirmLawyerRosterEntry): boolean {
  const name = entry.displayName.trim().toLowerCase();
  if (name === MANAGING_PARTNER.displayName.trim().toLowerCase()) return true;
  const norm = name.replace(/^atty\.?\s*/i, "");
  if (norm.includes("robert") && norm.includes("hernandez")) return true;
  const email = entry.email.trim().toLowerCase();
  return MANAGING_PARTNER.emails.some((value) => value.toLowerCase() === email);
}

/**
 * Managing partner is always listed first with a founding/managing designation.
 * When the live roster is empty, seed the full default lawyer list.
 */
export function ensureManagingPartnerOnRoster(roster: FirmLawyerRosterEntry[]): FirmLawyerRosterEntry[] {
  const active = activeFirmLawyersRoster(roster);
  if (!active.length) return [...DEFAULT_FIRM_LAWYERS_ROSTER];

  const defaultPartner = DEFAULT_FIRM_LAWYERS_ROSTER[0]!;
  const partnerIndex = active.findIndex(isManagingPartnerRosterEntry);
  const others = [...active];

  let partner: FirmLawyerRosterEntry;
  if (partnerIndex >= 0) {
    const found = others.splice(partnerIndex, 1)[0]!;
    partner = {
      ...found,
      id: found.id || defaultPartner.id,
      designation: found.designation?.trim() || defaultPartner.designation
    };
  } else {
    partner = { ...defaultPartner };
  }

  return [partner, ...others];
}

export function serializeFirmLawyersRoster(roster: FirmLawyerRosterEntry[]): string {
  return JSON.stringify(activeFirmLawyersRoster(roster));
}

export function findFirmLawyerByEmail(
  roster: FirmLawyerRosterEntry[],
  email: string
): FirmLawyerRosterEntry | undefined {
  const target = email.trim().toLowerCase();
  if (!target) return undefined;
  return activeFirmLawyersRoster(roster).find((entry) => entry.email.trim().toLowerCase() === target);
}

export function findFirmLawyerByName(
  roster: FirmLawyerRosterEntry[],
  name: string
): FirmLawyerRosterEntry | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  return activeFirmLawyersRoster(roster).find(
    (entry) => entry.displayName.trim().toLowerCase() === target
  );
}

export function firmLawyerNamesForTasks(roster: FirmLawyerRosterEntry[]): string[] {
  return activeFirmLawyersRoster(roster)
    .filter((entry) => entry.overseesTasks)
    .map((entry) => entry.displayName);
}

export function isFirmLawyerOnRoster(name: string, roster: FirmLawyerRosterEntry[]): boolean {
  const target = name.trim().toLowerCase();
  if (!target) return false;
  return activeFirmLawyersRoster(roster).some(
    (entry) => entry.displayName.trim().toLowerCase() === target
  );
}

export function lawyerFeeShareAmount(total: number, feeSharePercent: number): number {
  return Math.round(total * (feeSharePercent / 100) * 100) / 100;
}
