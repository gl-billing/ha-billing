"use client";

import { useEffect, type RefObject } from "react";

/** Focus the target element once when the component mounts (or when enabled becomes true). */
export function useFocusOnMount<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.requestAnimationFrame(() => ref.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [ref, enabled]);
}
