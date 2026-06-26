"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { resolveLoadErrorEmptyState, type LoadErrorContext } from "@/lib/load-error-copy";
import { SameWindowLink } from "@/components/SameWindowLink";

type Props = {
  errorMessage: string;
  context: LoadErrorContext;
  onRetry?: () => void;
  status?: number;
    className?: string;
};

export function SmartLoadEmptyState({
  errorMessage,
  context,
  onRetry,
  status,
  className = ""
}: Props) {
  const copy = resolveLoadErrorEmptyState(errorMessage, context, { status });

  const action: ReactNode = (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
      {copy.showRetry && onRetry ? (
        <button type="button" className="btn-primary max-w-[240px] text-sm" onClick={onRetry}>
          {copy.retryLabel}
        </button>
      ) : null}
      {copy.showSignIn ? (
        <SameWindowLink href="/login" className="btn-secondary max-w-[240px] text-center text-sm">
          Sign in again
        </SameWindowLink>
      ) : null}
    </div>
  );

  return (
    <EmptyState
      className={`smart-load-empty smart-load-empty--${copy.kind} ${className}`.trim()}
      title={copy.title}
      message={copy.message}
      action={onRetry || copy.showSignIn ? action : undefined}
    />
  );
}
