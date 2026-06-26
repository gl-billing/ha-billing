"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachContentProtection, createContentProtectionHandlers } from "@/lib/client-content-protection";
import { CONTENT_PROTECTION_NOTICE_DEBOUNCE_MS } from "@/lib/content-protection-notice";

type BlockReason = "context_menu" | "copy" | "cut" | "drag" | "shortcut" | "select";

type Options = {
  enabled?: boolean;
  showNotice?: boolean;
  onBlocked?: (reason: BlockReason) => void;
};

type Result = {
  noticeOpen: boolean;
  closeNotice: () => void;
};

export function useContentProtection({
  enabled = true,
  showNotice = true,
  onBlocked
}: Options = {}): Result {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const onBlockedRef = useRef(onBlocked);
  const lastNoticeAtRef = useRef(0);

  onBlockedRef.current = onBlocked;

  const closeNotice = useCallback(() => {
    setNoticeOpen(false);
  }, []);

  const openNotice = useCallback(() => {
    if (!showNotice) return;
    const now = Date.now();
    if (now - lastNoticeAtRef.current < CONTENT_PROTECTION_NOTICE_DEBOUNCE_MS) return;
    lastNoticeAtRef.current = now;
    setNoticeOpen(true);
  }, [showNotice]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const root = document.documentElement;
    root.classList.add("content-protection");

    const handlers = createContentProtectionHandlers({
      onBlocked: (reason) => {
        openNotice();
        onBlockedRef.current?.(reason);
      }
    });
    const detach = attachContentProtection(document, handlers);

    return () => {
      root.classList.remove("content-protection");
      detach();
    };
  }, [enabled, openNotice]);

  return { noticeOpen, closeNotice };
}
