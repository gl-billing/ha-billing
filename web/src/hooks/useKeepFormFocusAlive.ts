"use client";

import { useEffect } from "react";
import {
  captureFocusedField,
  restoreFocusedField,
  type FocusedFieldSnapshot
} from "@/lib/preserve-focus";

function fieldWasDisabled(element: HTMLElement): boolean {
  return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

function shouldRestore(snapshot: FocusedFieldSnapshot | null, target: HTMLElement): boolean {
  if (!snapshot) return false;
  if (snapshot.element === target) return true;
  if (snapshot.element.contains(target)) return true;
  if (target.contains(snapshot.element)) return true;
  return false;
}

/**
 * Restores keyboard focus to the last active text field when a brief `disabled`
 * toggle (e.g. background reload) would otherwise force the user to click again.
 */
export function useKeepFormFocusAlive() {
  useEffect(() => {
    let lastSnapshot: FocusedFieldSnapshot | null = null;

    const onFocusIn = () => {
      lastSnapshot = captureFocusedField();
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "attributes") continue;
        if (mutation.attributeName !== "disabled" && mutation.attributeName !== "aria-disabled") continue;

        const target = mutation.target;
        if (!(target instanceof HTMLElement)) continue;
        if (!shouldRestore(lastSnapshot, target)) continue;
        if (fieldWasDisabled(target)) continue;
        if (document.activeElement === lastSnapshot?.element) continue;

        restoreFocusedField(lastSnapshot);
      }
    });

    document.addEventListener("focusin", onFocusIn, true);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["disabled", "aria-disabled"]
    });

    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      observer.disconnect();
    };
  }, []);
}
