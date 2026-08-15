"use client";

import { signOut } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LayoutModeSwitcher } from "@/components/LayoutModeSwitcher";
import { SameWindowLink } from "@/components/SameWindowLink";
import styles from "@/components/mobile-home/MobileHome.module.css";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { APP_SHORT_NAME } from "@/lib/firm-brand";
import { mobileOfficeMenuGroups, mobileOfficeHomeHref } from "@/lib/space-nav";
import { isMobilePrimaryTab, mobileAppBackHref, HA_MOBILE_OPEN_MENU } from "@/lib/mobile-app-nav";
import appStyles from "@/components/mobile-app/mobile-app.module.css";
import type { NavUserProfile } from "@/lib/workspace-labels";

type Props = {
  signOutCallbackUrl?: string;
  billingAccess?: boolean;
  isAdmin?: boolean;
  navProfile?: NavUserProfile;
};

function MenuIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <path d="M1 1.5h20M1 8h20M1 14.5h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15.5 4.5 8 12l7.5 7.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileOfficeHeader(props: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  return <MobileOfficeHeaderView pathname={pathname} search={searchParams.toString()} {...props} />;
}

function MobileOfficeHeaderView({
  signOutCallbackUrl = "/login",
  billingAccess = true,
  isAdmin = false,
  navProfile = "full",
  pathname,
  search
}: Props & { pathname: string; search: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = APP_SHORT_NAME.replace(/\s+/g, " ").trim();
  const officeHref = mobileOfficeHomeHref();
  const showBack = !isMobilePrimaryTab(pathname, search);
  const backHref = mobileAppBackHref(officeHref, pathname, search);
  const groups = useMemo(
    () =>
      mobileOfficeMenuGroups({
        billingAccess,
        isAdmin,
        navProfile
      }),
    [billingAccess, isAdmin, navProfile]
  );

  useBodyScrollLock(menuOpen);

  useEffect(() => {
    function onOpenMenu() {
      setMenuOpen(true);
    }
    window.addEventListener(HA_MOBILE_OPEN_MENU, onOpenMenu);
    return () => window.removeEventListener(HA_MOBILE_OPEN_MENU, onOpenMenu);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <header className={`mobile-office-header ha-mobile-app no-print ${styles.header} ${appStyles.headerStack}`}>
        <div className={appStyles.headerRow}>
          <SameWindowLink href={officeHref} className={styles.brand} aria-label={`${title} home`}>
            <span className={styles.logoRing}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.png" alt="" width={80} height={30} className={styles.logo} />
            </span>
            <span className={styles.firmName}>{title}</span>
          </SameWindowLink>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
        {showBack ? (
          <div className={appStyles.backRow}>
            <SameWindowLink href={backHref} className={styles.backBtn} aria-label="Go back">
              <BackIcon />
              Back
            </SameWindowLink>
          </div>
        ) : null}
      </header>

      {menuOpen ? (
        <>
          <button
            type="button"
            className={`mobile-office-menu__backdrop ${styles.menuBackdrop}`}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className={`mobile-office-menu ha-mobile-app ${styles.menu}`} role="dialog" aria-label="Office menu">
            <div className={styles.menuHead}>
              <p className={styles.menuTitle}>Menu</p>
              <button type="button" className={styles.menuClose} onClick={() => setMenuOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {groups.map((group) => (
              <div key={group.label} className={styles.menuGroup}>
                <p className={styles.menuLabel}>{group.label}</p>
                <div className={styles.menuLinks}>
                  {group.links.map((link) => (
                    <SameWindowLink
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      className={
                        group.label === "Booking or adding"
                          ? `${styles.menuLink} ${styles.menuLinkPrimary}`
                          : styles.menuLink
                      }
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </SameWindowLink>
                  ))}
                </div>
              </div>
            ))}

            <LayoutModeSwitcher variant="sheet" />

            <button
              type="button"
              className={styles.signOut}
              onClick={() => {
                setMenuOpen(false);
                void signOut({ callbackUrl: signOutCallbackUrl });
              }}
            >
              Log Out
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
