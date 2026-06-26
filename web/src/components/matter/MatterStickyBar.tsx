"use client";

import { formatPeso } from "@/lib/gl-config";

type Props = {
  code: string;
  name: string;
  balance?: number;
  visible: boolean;
};

export function MatterStickyBar({ code, name, balance, visible }: Props) {
  if (!visible) return null;

  return (
    <div className="matter-sticky-bar no-print" role="status" aria-live="polite">
      <div className="matter-sticky-bar__accent" aria-hidden />
      <div className="matter-sticky-bar__main">
        <span className="matter-sticky-bar__code">{code}</span>
        <span className="matter-sticky-bar__name">{name}</span>
      </div>
      {typeof balance === "number" ? (
        <span className="matter-sticky-bar__balance amount-serif">{formatPeso(balance)}</span>
      ) : null}
    </div>
  );
}
