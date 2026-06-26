"use client";

import type { MouseEvent, ReactNode } from "react";
import { useClientMatter } from "@/components/office-tasks/ClientMatterPanel";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";

type Props = {
  code: string;
  className?: string;
  title?: string;
  children?: ReactNode;
};

/** Opens the unified matter page for this client code. */
export function ClientCodeButton({ code, className = "", title, children }: Props) {
  const matter = useClientMatter();
  const { goTo } = useMatterNavigation();
  const trimmed = code.trim().toUpperCase();
  const label = children ?? trimmed;

  if (!trimmed) {
    return <span className={className}>{label}</span>;
  }

  function open(event: MouseEvent) {
    event.stopPropagation();
    if (matter) {
      matter.openClientCode(trimmed);
      return;
    }
    goTo(trimmed);
  }

  return (
    <button
      type="button"
      className={`client-code-link ${className}`.trim()}
      title={title ?? `View ${trimmed} matter`}
      onClick={open}
    >
      {label}
    </button>
  );
}
