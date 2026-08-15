"use client";

import { useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { matterReturnLabel, readMatterReturnFromSearchParams } from "@/lib/matter-return";

type Props = {
  className?: string;
  fallbackHref?: string;
  /** Icon-only control for the native-phone matter chrome. */
  compact?: boolean;
};

export function MatterBackLink({
  className = "matter-page__back no-print",
  fallbackHref = "/app",
  compact = false
}: Props) {
  const searchParams = useSearchParams();
  const returnPath = readMatterReturnFromSearchParams(searchParams);
  const href = returnPath || fallbackHref;
  const label = matterReturnLabel(returnPath || fallbackHref);

  return (
    <SameWindowLink href={href} className={className} aria-label={compact ? label : undefined}>
      {compact ? "←" : `← ${label}`}
    </SameWindowLink>
  );
}
