"use client";

import type { ReactNode } from "react";

type Props = {
  pageKey: string;
  children: ReactNode;
  className?: string;
};

/** Fade/slide wrapper for in-app tab changes (billing, tasks). */
export function PageTransition({ pageKey, children, className = "" }: Props) {
  return (
    <div key={pageKey} className={`page-enter ${className}`.trim()}>
      {children}
    </div>
  );
}
