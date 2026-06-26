export const FIRM_LAWYERS_ROSTER_SETTING_KEY = "Firm Lawyers Roster";

export type FirmLawyerRosterEntry = {
  id: string;
  /** e.g. Atty. Maria Hernandez */
  displayName: string;
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
