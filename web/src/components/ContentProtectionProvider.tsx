"use client";

import { ContentProtectionNotice } from "@/components/ContentProtectionNotice";
import { useContentProtection } from "@/hooks/useContentProtection";

function contentProtectionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONTENT_PROTECTION !== "false";
}

/** Blocks right-click, selection, and clipboard shortcuts outside form fields. */
export function ContentProtectionProvider() {
  const enabled = contentProtectionEnabled();
  const { noticeOpen, closeNotice } = useContentProtection({ enabled });

  if (!enabled) return null;

  return <ContentProtectionNotice open={noticeOpen} onClose={closeNotice} />;
}
