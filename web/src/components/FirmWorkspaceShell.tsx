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
import { OfficeNav } from "@/components/OfficeNav";
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
  chromeTopBanner?: ReactNode;
  navTabs?: ReactNode;
  tabShortcuts?: TabShortcutItem[];
  tabShortcutsTitle?: string;
  onReplayWorkspaceGuide?: () => void;
  signOutCallbackUrl?: string;
  children: ReactNode;
};

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
  chromeTopBanner,
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

        <OfficeNav />

        <div className="firm-shell-chrome no-print">
          <div className="firm-shell-chrome__top">
            {chromeTopBanner}
            <OfflineStatusBanner />
            <WorkspaceBootstrap billingAccess={billingAccess} />
            <TodayBirthdaysBanner billingAccess={billingAccess} />
            <GlobalSearchBar
              value={searchValue}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              busy={searchBusy}
              billingAccess={billingAccess}
            />
          </div>

          <WorkspaceBreadcrumb workspace={workspace} page={breadcrumbPage} detail={breadcrumbDetail} className="firm-shell-chrome__crumb" />
          {onReplayWorkspaceGuide ? (
            <button type="button" className="workspace-guide-replay firm-shell-chrome__guide" onClick={onReplayWorkspaceGuide}>
              Show guide again
            </button>
          ) : null}
        </div>

        {navTabs ? <div className="firm-workspace-nav no-print min-w-0">{navTabs}</div> : null}

        <div className="firm-workspace-body min-w-0">{children}</div>

        <FirmStatusToast message={statusMessage} variant={statusVariant} />

        <AppFooter />

        <FirmCommandPalette workspace={workspace} billingAccess={billingAccess} />
      </div>
    </TodayBirthdaysProvider>
  );
}
