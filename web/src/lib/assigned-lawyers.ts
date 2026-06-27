import { MANAGING_PARTNER } from "@/lib/firm-team-config";
import {
  activeFirmLawyersRoster,
  ensureManagingPartnerOnRoster,
  type FirmLawyerRosterEntry
} from "@/lib/firm-lawyers-roster";
import { isManagingPartnerAttorney, UNASSIGNED_ATTORNEY_LABEL } from "@/lib/firm-allocation";

/** Lawyer names for client assignment dropdowns — roster order, managing partner first. */
export function buildFirmLawyerDropdownOptions(roster: FirmLawyerRosterEntry[]): string[] {
  const active = ensureManagingPartnerOnRoster(roster);
  const names: string[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  const managingPartnerOnRoster = active.find((entry) => isManagingPartnerAttorney(entry.displayName));
  if (managingPartnerOnRoster) add(managingPartnerOnRoster.displayName);
  else add(MANAGING_PARTNER.displayName);

  for (const entry of active) add(entry.displayName);
  return names;
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
