import {
  clioSectionsForUser,
  defaultClioSectionForUser,
  findClioPrimary,
  type ClioNavId,
  type ClioVisibilityOptions
} from "@/lib/clio/workspace-nav";

/** Keep the current section when switching primary on the same app; otherwise use role default. */
export function sectionForPrimarySwitch(
  nextNav: ClioNavId,
  activeNav: ClioNavId,
  activeSection: string,
  visibility: ClioVisibilityOptions
): ReturnType<typeof defaultClioSectionForUser> {
  const primary = findClioPrimary(nextNav);
  const allowed = clioSectionsForUser(primary, visibility);
  if (nextNav === activeNav) {
    const kept = allowed.find((section) => section.id === activeSection);
    if (kept) return kept;
  }
  return defaultClioSectionForUser(primary, visibility);
}
