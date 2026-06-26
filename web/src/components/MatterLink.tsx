"use client";

import type { ComponentProps, ReactNode } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import type { MatterQuery, MatterTab } from "@/lib/matter-routes";

type Props = Omit<ComponentProps<typeof SameWindowLink>, "href"> & {
  code: string;
  tab?: MatterTab;
  extra?: Omit<MatterQuery, "tab" | "from">;
  children: ReactNode;
};

/** Same-window link to a client matter, preserving the current page as the return target. */
export function MatterLink({ code, tab, extra, children, ...rest }: Props) {
  const { hrefFor } = useMatterNavigation();
  return (
    <SameWindowLink href={hrefFor(code, tab, extra)} {...rest}>
      {children}
    </SameWindowLink>
  );
}
