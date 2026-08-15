"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import {
  mobileBottomNavActive,
  mobileBottomNavItems,
  openMobileOfficeMenu,
  type MobileNavOptions
} from "@/lib/mobile-app-nav";
import styles from "./mobile-app.module.css";

type Props = MobileNavOptions;

function NavIcon({ id }: { id: "home" | "calendar" | "tasks" | "clients" | "more" }) {
  const common = {
    className: styles.navIcon,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  if (id === "home") {
    return (
      <svg {...common}>
        <path d="M4.5 11.2 12 4.8l7.5 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2h-3.6V20.5H6A1.5 1.5 0 0 1 4.5 19z" />
      </svg>
    );
  }
  if (id === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    );
  }
  if (id === "tasks") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M8.2 12.2 10.8 14.8 15.8 9.4" />
      </svg>
    );
  }
  if (id === "clients") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8.2" r="2.6" />
        <circle cx="16.2" cy="9.1" r="2.1" />
        <path d="M4.6 18.4c.4-2.8 2.6-4.4 4.4-4.4s4 1.6 4.4 4.4" />
        <path d="M13.4 16.6c.5-1.6 1.8-2.6 3-2.6 1.4 0 2.7 1 3.1 2.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MobileBottomNav({ billingAccess = true }: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const active = mobileBottomNavActive(pathname, searchParams.toString());
  const items = mobileBottomNavItems({ billingAccess });

  return (
    <nav className={`mobile-office-bottom-nav ha-mobile-app no-print ${styles.bottomNav}`} aria-label="Main">
      {items.map((item) => (
        <SameWindowLink
          key={item.id}
          href={item.href}
          className={`${styles.navItem}${active === item.id ? ` ${styles.navItemActive}` : ""}`}
          aria-current={active === item.id ? "page" : undefined}
        >
          <NavIcon id={item.id} />
          {item.label}
        </SameWindowLink>
      ))}
      <button
        type="button"
        className={`${styles.navItem}${active === "more" ? ` ${styles.navItemActive}` : ""}`}
        aria-current={active === "more" ? "page" : undefined}
        onClick={() => openMobileOfficeMenu()}
      >
        <NavIcon id="more" />
        More
      </button>
    </nav>
  );
}
