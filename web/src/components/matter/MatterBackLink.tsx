"use client";

import { useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { matterReturnLabel, readMatterReturnFromSearchParams } from "@/lib/matter-return";

type Props = {
  className?: string;
  fallbackHref?: string;
};

export function MatterBackLink({ className = "matter-page__back no-print", fallbackHref = "/app" }: Props) {
  const searchParams = useSearchParams();
  const returnPath = readMatterReturnFromSearchParams(searchParams);
  const href = returnPath || fallbackHref;
  const label = matterReturnLabel(returnPath || fallbackHref);

  return (
    <SameWindowLink href={href} className={className}>
      ← {label}
    </SameWindowLink>
  );
}
