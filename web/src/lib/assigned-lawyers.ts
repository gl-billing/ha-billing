import { MANAGING_PARTNER } from "@/lib/firm-team-config";
import { activeFirmLawyersRoster, type FirmLawyerRosterEntry } from "@/lib/firm-lawyers-roster";
import { isManagingPartnerAttorney, UNASSIGNED_ATTORNEY_LABEL } from "@/lib/firm-allocation";

/** Lawyer names for client assignment dropdowns — managing partner first, then roster lawyers. */
export function buildFirmLawyerDropdownOptions(roster: FirmLawyerRosterEntry[]): string[] {
  const names = new Set<string>();
  names.add(MANAGING_PARTNER.displayName);
  for (const entry of activeFirmLawyersRoster(roster)) {
    if (entry.displayName.trim()) names.add(entry.displayName.trim());
  }
  return [...names].sort((a, b) => {
    if (a === MANAGING_PARTNER.displayName) return -1;
    if (b === MANAGING_PARTNER.displayName) return 1;
    return a.localeCompare(b);
  });
}

export function mergeLawyerDropdownOption(options: string[], current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed || options.includes(trimmed)) return options;
  return [...options, trimmed].sort((a, b) => a.localeCompare(b));
}

export function formatClientAssignedLawyers(primary?: string | null, secondary?: string | null): string {
  const parts = [primary, secondary].map((value) => String(value || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

/** Distinct lawyers assigned on a matter (primary + co-assigned). */
export function distinctMatterLawyers(primary?: string | null, secondary?: string | null): string[] {
  const seen = new Set<string>();
  const lawyers: string[] = [];
  for (const raw of [primary, secondary || ""]) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lawyers.push(name);
  }
  return lawyers;
}

export function matterHasSoleAssignedLawyer(primary?: string | null, secondary?: string | null): boolean {
  return distinctMatterLawyers(primary, secondary).length <= 1;
}

/** Associate share for acceptance fees — the assigned lawyer who is not the managing partner. */
export function resolveAcceptanceFeeAssociateFromClient(
  assignedAttorney: string,
  coAssignedAttorney?: string | null
): string {
  const lawyers = [assignedAttorney, coAssignedAttorney || ""]
    .map((value) => value.trim())
    .filter(Boolean);

  const associates = lawyers.filter((name) => !isManagingPartnerAttorney(name));
  if (associates.length === 1) return associates[0];
  if (associates.length > 1) return associates[0];

  if (lawyers.length === 1 && isManagingPartnerAttorney(lawyers[0])) {
    return UNASSIGNED_ATTORNEY_LABEL;
  }

  return lawyers[0] || UNASSIGNED_ATTORNEY_LABEL;
}
