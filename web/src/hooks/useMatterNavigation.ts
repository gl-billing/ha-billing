"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { matterReturnPathForNavigation, withMatterReturn } from "@/lib/matter-return";
import { matterHref, type MatterQuery, type MatterTab } from "@/lib/matter-routes";

export function useMatterReturnPath(): string {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  return useMemo(
    () => matterReturnPathForNavigation(pathname, searchParams),
    [pathname, searchParams]
  );
}

export function useMatterNavigation() {
  const router = useRouter();
  const returnPath = useMatterReturnPath();

  return useMemo(
    () => ({
      returnPath,
      hrefFor(code: string, tab?: MatterTab, extra?: Omit<MatterQuery, "tab">) {
        return matterHref(code, tab, { ...extra, from: returnPath });
      },
      goTo(code: string, tab?: MatterTab, extra?: Omit<MatterQuery, "tab">) {
        router.push(matterHref(code, tab, { ...extra, from: returnPath }));
      },
      withReturn(href: string) {
        return withMatterReturn(href, returnPath);
      }
    }),
    [returnPath, router]
  );
}
