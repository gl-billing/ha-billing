"use client";

import { useSession } from "next-auth/react";
import { MatterLink } from "@/components/MatterLink";

type LinkProps = {
  clientCode: string;
  caseHint?: string;
  className?: string;
};

/** Jump to unified matter page — tasks tab. */
export function TasksMatterLink({
  clientCode,
  caseHint,
  className = "cross-system-link"
}: LinkProps) {
  const code = clientCode.trim().toUpperCase();
  if (!code) return null;

  return (
    <MatterLink
      code={code}
      tab="tasks"
      extra={caseHint?.trim() ? { case: caseHint.trim() } : undefined}
      className={className}
    >
      View tasks &amp; hearings →
    </MatterLink>
  );
}

/** Jump to unified matter page — billing tab (billing staff only). */
export function BillingMatterLink({
  clientCode,
  className = "cross-system-link cross-system-link--billing"
}: LinkProps) {
  const { data: session } = useSession();
  const billingAccess = session?.user?.billingAccess !== false;
  const code = clientCode.trim().toUpperCase();

  if (!billingAccess || !code) return null;

  return (
    <MatterLink code={code} tab="billing" className={className}>
      Open billing profile →
    </MatterLink>
  );
}
