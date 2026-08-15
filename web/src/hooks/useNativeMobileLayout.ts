"use client";

import { useLayoutMode } from "@/components/LayoutModeProvider";

/** Phone + mobile layout mode. Desktop stays on desk chrome. */
export function useNativeMobileLayout(): boolean {
  const { layoutMode, isPhone } = useLayoutMode();
  return isPhone && layoutMode === "mobile";
}
