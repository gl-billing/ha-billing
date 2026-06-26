"use client";

import { useEffect } from "react";
import { prefetchCachedFetch } from "@/lib/client-fetch-cache";
import { readJsonResponse } from "@/lib/fetch-json";

type Props = {
  billingAccess?: boolean;
  };

/** Prefetch shared sheet caches once per workspace session to reduce quota spikes. */
export function WorkspaceBootstrap({ billingAccess = true }: Props) {
  useEffect(() => {
    void fetch("/api/workspace/bootstrap").catch(() => undefined);

    if (billingAccess) {
      prefetchCachedFetch("billing-home-dashboard", async () => {
        const res = await fetch("/api/home");
        if (!res.ok) return null;
        return readJsonResponse(res);
      });
    }
  }, [billingAccess]);

  return null;
}
