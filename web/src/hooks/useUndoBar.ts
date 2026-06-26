"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type UndoBarState<T = unknown> = {
  label: ReactNode;
  hint?: string;
  payload: T;
  expiresAt: number;
};

const DEFAULT_MS = 30_000;

export function useUndoBar<T = unknown>(windowMs = DEFAULT_MS) {
  const [pending, setPending] = useState<UndoBarState<T> | null>(null);
  const timerRef = useRef<number | null>(null);
  const commitRef = useRef<((payload: T) => void | Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    commitRef.current = null;
    setPending(null);
  }, [clearTimer]);

  const schedule = useCallback(
    (
      state: Omit<UndoBarState<T>, "expiresAt">,
      commit: (payload: T) => void | Promise<void>
    ) => {
      clearTimer();
      commitRef.current = commit;
      const expiresAt = Date.now() + windowMs;
      setPending({ ...state, expiresAt });
      timerRef.current = window.setTimeout(() => {
        const payload = state.payload;
        const fn = commitRef.current;
        dismiss();
        void fn?.(payload);
      }, windowMs);
    },
    [clearTimer, dismiss, windowMs]
  );

  const undo = useCallback(() => {
    dismiss();
  }, [dismiss]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { pending, schedule, undo, dismiss };
}
