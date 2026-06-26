"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

type Options = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  itemCount: number;
  itemHeight?: number;
  panelPadding?: number;
  gap?: number;
  minWidth?: number;
};

export function useAnchoredMenuPosition({
  open,
  anchorRef,
  itemCount,
  itemHeight = 40,
  panelPadding = 8,
  gap = 6,
  minWidth = 120
}: Options): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    function update() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const panelHeight = Math.max(itemCount, 1) * itemHeight + panelPadding;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      let top = rect.bottom + gap;
      if (top + panelHeight > viewportHeight - margin) {
        top = rect.top - panelHeight - gap;
      }
      top = Math.max(margin, Math.min(top, viewportHeight - panelHeight - margin));

      let left = rect.right - minWidth;
      left = Math.max(margin, Math.min(left, viewportWidth - minWidth - margin));

      setStyle({
        position: "fixed",
        top,
        left,
        minWidth,
        zIndex: 200
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, itemCount, itemHeight, panelPadding, gap, minWidth]);

  return style;
}
