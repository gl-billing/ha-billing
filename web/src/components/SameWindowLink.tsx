"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  children: ReactNode;
};

/** In-app navigation — same tab/window on desktop, mobile Safari, and home-screen PWA. */
export function SameWindowLink({ href, children, ...rest }: Props) {
  return (
    <Link href={href} prefetch={false} {...rest}>
      {children}
    </Link>
  );
}
