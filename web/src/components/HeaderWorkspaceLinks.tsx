"use client";

import { SameWindowLink } from "@/components/SameWindowLink";

/** Shared header links: Office hub (before Sign out). */
export function HeaderWorkspaceLinks() {
  return (
    <SameWindowLink href="/office-hub" className="header-app-link header-app-link--hub">
      Home
    </SameWindowLink>
  );
}
