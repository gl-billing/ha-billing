"use client";

import type { ReactNode } from "react";
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
import { useStaffPresenceHeartbeat } from "@/hooks/useStaffPresenceHeartbeat";
import type { TabShortcutItem } from "@/lib/workspace-tab-shortcuts";

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
  /** Clio secondary sections above firm search. */
  clioSectionTabs?: ReactNode;
  navTabs?: ReactNode;
  tabShortcuts?: TabShortcutItem[];
  tabShortcutsTitle?: string;
  onReplayWorkspaceGuide?: () => void;
  signOutCallbackUrl?: string;
  children: ReactNode;
};

/**
 * HA firm shell — Clio left rail + sub-tabs layout (Practice structure).
 * Theme stays HA monochrome via ha-theme.css / ha-clio-shell.css.
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
  children
}: Props) {
  useKeepFormFocusAlive();
  useStaffPresenceHeartbeat({ workspace });

  const shellClass = [
    "app-shell",
    "app-shell-wide",
    "firm-workspace",
    "firm-clio-shell",
    workspace === "tasks" ? "tasks-app" : "billing-app"
  ].join(" ");

  return (
    <TodayBirthdaysProvider billingAccess={billingAccess}>
      <div className={shellClass}>
        <FirmBrandHeader
          workspace={workspace}
          name={name}
          email={email}
          displayName={displayName}
          billingAccess={billingAccess}
          signOutCallbackUrl={signOutCallbackUrl ?? "/login"}
          className="brand-header--shell-flush mb-4"
        >
          <NotificationsCenter compact />
          <KeyboardShortcutsHelp
            className="brand-header__shortcuts"
            tabShortcuts={tabShortcuts}
            tabShortcutsTitle={tabShortcutsTitle}
          />
        </FirmBrandHeader>

        {navTabs ? (
          <div className="ha-clio-layout">
            <div className="ha-clio-layout__nav no-print">{navTabs}</div>
            <div className="ha-clio-layout__main min-w-0">
              <div className="firm-shell-chrome no-print">
                <div className="firm-shell-chrome__top">
                  {chromeTopBanner}
                  <OfflineStatusBanner onStatus={onOfflineStatus} />
                  <WorkspaceBootstrap billingAccess={billingAccess} />
                  <TodayBirthdaysBanner billingAccess={billingAccess} />
                  {clioSectionTabs}
                  <GlobalSearchBar
                    value={searchValue}
                    onChange={onSearchChange}
                    onSubmit={onSearchSubmit}
                    busy={searchBusy}
                    billingAccess={billingAccess}
                    placeholder="Type here — client name, matter code, task, or hearing…"
                  />
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
            </div>
          </div>
        ) : (
          <>
            <div className="firm-shell-chrome no-print">
              <div className="firm-shell-chrome__top">
                {chromeTopBanner}
                <OfflineStatusBanner onStatus={onOfflineStatus} />
                <WorkspaceBootstrap billingAccess={billingAccess} />
                <TodayBirthdaysBanner billingAccess={billingAccess} />
                {clioSectionTabs}
                <GlobalSearchBar
                  value={searchValue}
                  onChange={onSearchChange}
                  onSubmit={onSearchSubmit}
                  busy={searchBusy}
                  billingAccess={billingAccess}
                />
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
          </>
        )}

        <AppFooter />

        <FirmCommandPalette workspace={workspace} billingAccess={billingAccess} />
      </div>
    </TodayBirthdaysProvider>
  );
}
