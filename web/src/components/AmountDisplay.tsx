"use client";

import { formatPeso } from "@/lib/gl-config";

type Props = {
  value: number;
  className?: string;
  /** Larger serif display for hero amounts */
  hero?: boolean;
};

export function AmountDisplay({ value, className = "", hero = false }: Props) {
  return (
    <span
      className={[
        hero ? "amount-serif amount-serif--hero" : "amount-serif",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {formatPeso(value)}
    </span>
  );
}
