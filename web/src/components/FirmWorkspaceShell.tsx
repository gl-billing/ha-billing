"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";
import { useKeepFormFocusAlive } from "@/hooks/useKeepFormFocusAlive";
import { AppFooter } from "@/components/AppFooter";
import { FirmBrandHeader } from "@/components/FirmBrandHeader";
import { FirmStatusToast } from "@/components/FirmStatusToast";
import type { FirmStatusVariant } from "@/lib/firm-status-report";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { FirmCommandPalette } from "@/components/FirmCommandPalette";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { TodayBirthdaysBanner } from "@/components/TodayBirthdaysBanner";
import { TodayBirthdaysProvider } from "@/components/TodayBirthdaysProvider";
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb";
import { WorkspaceBootstrap } from "@/components/WorkspaceBootstrap";
import { OfflineStatusBanner } from "@/components/OfflineStatusBanner";
import { MobileSpaceDeskNav } from "@/components/MobileSpaceDeskNav";
import { BitrixSpaceToolbar } from "@/components/BitrixSpaceToolbar";
import { BitrixSpaceTopNav } from "@/components/BitrixSpaceTopNav";
import { spaceInviteHref } from "@/lib/space-nav";
import { FIRM_COPYRIGHT_HOLDER } from "@/lib/firm-brand";
import { useStaffPresenceHeartbeat } from "@/hooks/useStaffPresenceHeartbeat";
import type { TabShortcutItem } from "@/lib/workspace-tab-shortcuts";
import type { NavUserProfile } from "@/lib/workspace-labels";

export type FirmWorkspace = "billing" | "tasks";

type Props = {
  workspace: FirmWorkspace;
  wide?: boolean;
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
  billingAccess?: boolean;
  breadcrumbPage?: string;
  breadcrumbDetail?: string;
  searchValue?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  searchBusy?: boolean;
  statusMessage?: string;
  statusVariant?: FirmStatusVariant;
  onOfflineStatus?: (message: string, isError?: boolean) => void;
  chromeTopBanner?: ReactNode;
  /** Space secondary sections under the top chrome. */
  clioSectionTabs?: ReactNode;
  navTabs?: ReactNode;
  tabShortcuts?: TabShortcutItem[];
  tabShortcutsTitle?: string;
  onReplayWorkspaceGuide?: () => void;
  signOutCallbackUrl?: string;
  /** Space top-nav / rail filtering (optional). */
  isAdmin?: boolean;
  navProfile?: NavUserProfile;
  children: ReactNode;
};

/**
 * HA firm shell — Bitrix Space always on (black/white via ha-space-shell.css).
 */
export function FirmWorkspaceShell({
  workspace,
  wide = false,
  name,
  email,
  displayName,
  billingAccess = true,
  breadcrumbPage,
  breadcrumbDetail,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchBusy,
  statusMessage,
  statusVariant = "ok",
  onOfflineStatus,
  chromeTopBanner,
  clioSectionTabs,
  navTabs,
  tabShortcuts,
  tabShortcutsTitle,
  onReplayWorkspaceGuide,
  signOutCallbackUrl,
  isAdmin = false,
  navProfile = "full",
  children
}: Props) {
  useKeepFormFocusAlive();
  useStaffPresenceHeartbeat({ workspace });

  const signOutUrl = signOutCallbackUrl ?? "/login";
  const firmName = FIRM_COPYRIGHT_HOLDER;

  const shellClass = [
    "app-shell",
    "app-shell-wide",
    "firm-workspace",
    "firm-space-shell",
    workspace === "tasks" ? "tasks-app" : "billing-app",
    wide ? "" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TodayBirthdaysProvider billingAccess={billingAccess}>
      <div className={shellClass}>
        <FirmBrandHeader
          workspace={workspace}
          name={name}
          email={email}
          displayName={displayName}
          billingAccess={billingAccess}
          signOutCallbackUrl={signOutUrl}
          className="sr-only"
        />

        <BitrixSpaceTopNav
          billingAccess={billingAccess}
          isAdmin={isAdmin}
          navProfile={navProfile}
          firmName={firmName}
          inviteHref={spaceInviteHref()}
          searchSlot={
            <GlobalSearchBar
              value={searchValue}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              busy={searchBusy}
              billingAccess={billingAccess}
              placeholder="Search"
            />
          }
          utilitiesSlot={
            <>
              <NotificationsCenter compact />
              <KeyboardShortcutsHelp
                className="brand-header__shortcuts"
                tabShortcuts={tabShortcuts}
                tabShortcutsTitle={tabShortcutsTitle}
              />
            </>
          }
        />

        {navTabs ? (
          <div className="trial-firm-layout">
            <div className="trial-firm-layout__nav no-print">{navTabs}</div>
            <div className="trial-firm-layout__main min-w-0">
              <div className="firm-shell-chrome no-print">
                <div className="firm-shell-chrome__top">
                  {chromeTopBanner}
                  <BitrixSpaceToolbar
                    billingAccess={billingAccess}
                    messagesSlot={null}
                    notificationsSlot={null}
                    themeSlot={null}
                    hideInvite
                    findValue={searchValue}
                    onFindChange={onSearchChange}
                    onFindSubmit={onSearchSubmit}
                    profileSlot={
                      email ? (
                        <button
                          type="button"
                          className="bitrix-space-btn bitrix-space-btn--ghost bitrix-space-btn--signout"
                          onClick={() => {
                            void signOut({ callbackUrl: signOutUrl });
                          }}
                        >
                          Sign out
                        </button>
                      ) : null
                    }
                  />
                  <OfflineStatusBanner onStatus={onOfflineStatus} />
                  <WorkspaceBootstrap billingAccess={billingAccess} />
                  <TodayBirthdaysBanner billingAccess={billingAccess} />
                </div>

                {onReplayWorkspaceGuide ? (
                  <button
                    type="button"
                    className="workspace-guide-replay firm-shell-chrome__guide"
                    onClick={onReplayWorkspaceGuide}
                  >
                    Office procedures
                  </button>
                ) : null}
              </div>

              <FirmStatusToast message={statusMessage} variant={statusVariant} />

              <div className="firm-workspace-body min-w-0">
                {clioSectionTabs ? (
                  <div className="firm-shell-subnav no-print">{clioSectionTabs}</div>
                ) : null}
                {children}
              </div>

              <AppFooter />
            </div>
          </div>
        ) : (
          <div className="firm-space-desk-scroll min-w-0">
            <div className="firm-shell-chrome no-print">
              <div className="firm-shell-chrome__top">
                {chromeTopBanner}
                <BitrixSpaceToolbar
                  billingAccess={billingAccess}
                  messagesSlot={null}
                  notificationsSlot={null}
                  themeSlot={null}
                  hideInvite
                  findValue={searchValue}
                  onFindChange={onSearchChange}
                  onFindSubmit={onSearchSubmit}
                  profileSlot={
                    email ? (
                      <button
                        type="button"
                        className="bitrix-space-btn bitrix-space-btn--ghost bitrix-space-btn--signout"
                        onClick={() => {
                          void signOut({ callbackUrl: signOutUrl });
                        }}
                      >
                        Sign out
                      </button>
                    ) : null
                  }
                />
                <OfflineStatusBanner onStatus={onOfflineStatus} />
                <WorkspaceBootstrap billingAccess={billingAccess} />
                <TodayBirthdaysBanner billingAccess={billingAccess} />
              </div>

              <WorkspaceBreadcrumb
                workspace={workspace}
                page={breadcrumbPage}
                detail={breadcrumbDetail}
                className="firm-shell-chrome__crumb"
              />
              {onReplayWorkspaceGuide ? (
                <button
                  type="button"
                  className="workspace-guide-replay firm-shell-chrome__guide"
                  onClick={onReplayWorkspaceGuide}
                >
                  Office procedures
                </button>
              ) : null}
            </div>

            <FirmStatusToast message={statusMessage} variant={statusVariant} />

            <div className="firm-workspace-body min-w-0">{children}</div>

            <AppFooter />
          </div>
        )}

        <MobileSpaceDeskNav billingAccess={billingAccess} />

        <FirmCommandPalette workspace={workspace} billingAccess={billingAccess} />
      </div>
    </TodayBirthdaysProvider>
  );
}
