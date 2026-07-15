"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SameWindowLink } from "@/components/SameWindowLink";
import { FirmLogoBanner } from "@/components/FirmLogoBanner";
import { FirmCopyright } from "@/components/FirmCopyright";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { MyWorkHubSummary } from "@/components/MyWorkHubSummary";
import { OfficeHubAnnouncement } from "@/components/OfficeHubAnnouncement";
import { OfficeHubPwaHint } from "@/components/OfficeHubPwaHint";
import { HubRoleShortcuts } from "@/components/HubRoleShortcuts";
import { NewStaffHint } from "@/components/NewStaffHint";
import { ClientMatterProvider } from "@/components/office-tasks/ClientMatterPanel";
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb";
import { fetchJson, readJsonResponse } from "@/lib/fetch-json";
import { cachedFetchJson, prefetchCachedFetch } from "@/lib/client-fetch-cache";
import { firmAppHref } from "@/lib/firm-apps";
import type { OfficeHubSummary } from "@/lib/office-hub/summary";
import { getAllowedLastWorkspace } from "@/lib/staff-prefs";
import { getLastWorkspace, setLastWorkspace, type WorkspaceId } from "@/lib/office-hub/storage";
import type { OfficeAnnouncementDraft } from "@/lib/sheets/settings";
import { OFFICE_TIMEZONE } from "@/lib/office-tasks/date-only";
import { formatStaffDisplayName } from "@/lib/user-display";
import { useStaffPresenceHeartbeat } from "@/hooks/useStaffPresenceHeartbeat";

const OFFICE_LOCATION = "Philippines";
const tasksHref = firmAppHref("/app");
const billingHref = "/billing";

type HubUser = {
  name?: string | null;
  email?: string | null;
  displayName: string;
  billingAccess: boolean;
  isAdmin: boolean;
};

type Props = {
  initialSummary: OfficeHubSummary;
  hubUser: HubUser;
};

function officeHour(date: Date): number {
  return Number(
    date.toLocaleString("en-PH", { timeZone: OFFICE_TIMEZONE, hour: "numeric", hour12: false })
  );
}

function greetingFor(date: Date): string {
  const hour = officeHour(date);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatClockParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: OFFICE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
    dayPeriod: pick("dayPeriod")
  };
}

function formatDateLine(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function launcherClass(base: string, workspace: WorkspaceId, lastWorkspace: WorkspaceId | null): string {
  return lastWorkspace === workspace ? `${base} office-hub__launcher--last` : base;
}

export function OfficeHubLauncher({ initialSummary, hubUser }: Props) {
  const billingAccess = hubUser.billingAccess;
  const displayLabel = formatStaffDisplayName(hubUser.name, hubUser.email) || "team";
  useStaffPresenceHeartbeat({ workspace: "hub" });

  const [now, setNow] = useState(() => new Date());
  const [lastWorkspace, setLastWorkspaceState] = useState<WorkspaceId | null>(null);
  const [summary, setSummary] = useState<OfficeHubSummary>(initialSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [secretaryNav, setSecretaryNav] = useState(false);

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => (res.ok ? readJsonResponse<{ secretaryNav?: boolean }>(res) : null))
      .then((json) => {
        if (json) setSecretaryNav(Boolean(json.secretaryNav));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!billingAccess && getLastWorkspace() === "billing") {
      setLastWorkspace("tasks");
    }
    setLastWorkspaceState(getAllowedLastWorkspace(billingAccess));
  }, [billingAccess]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!billingAccess) return;
    prefetchCachedFetch("prefetch-clients", async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) return null;
      return readJsonResponse(res);
    });
    prefetchCachedFetch("prefetch-tasks-home", async () => {
      const res = await fetch("/api/tasks/home");
      if (!res.ok) return null;
      return readJsonResponse(res);
    });
  }, [billingAccess]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setSummaryLoading(true);
      try {
        const { data, fromCache } = await cachedFetchJson<OfficeHubSummary | { error?: string }>(
          "office-hub-summary",
          async () => {
            const { ok, data } = await fetchJson<OfficeHubSummary | { error?: string }>("/api/office-hub/summary", {
              timeoutMs: 45_000
            });
            if (!ok || "error" in data) throw new Error("summary failed");
            return data as OfficeHubSummary;
          }
        );
        if (!cancelled && !("error" in data)) {
          const next = data as OfficeHubSummary;
          setSummary({ ...next, isAdmin: hubUser.isAdmin || next.isAdmin });
          if (!fromCache) setSummaryLoading(false);
        }
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [hubUser.isAdmin]);

  const rememberWorkspace = useCallback((workspace: WorkspaceId) => {
    setLastWorkspace(workspace);
    setLastWorkspaceState(workspace);
  }, []);

  const handleAnnouncementChange = useCallback(
    (next: { active: string | null; draft: OfficeAnnouncementDraft }) => {
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              announcement: next.active,
              announcementDraft: next.draft
            }
          : prev
      );
    },
    []
  );

  const greeting = useMemo(() => greetingFor(now), [now]);
  const clock = useMemo(() => formatClockParts(now), [now]);

  return (
    <ClientMatterProvider lazyLoadItems>
      <div className="office-hub">
        <section className="office-hub__letterhead">
          <FirmLogoBanner className="firm-logo-banner--hub" priority />
        </section>

        <div className="office-hub__shell">
          <main className="office-hub__main">
            <OfficeHubAnnouncement
              active={summary.announcement}
              draft={summary.announcementDraft}
              isAdmin={hubUser.isAdmin}
              onChange={handleAnnouncementChange}
            />

            <section className="office-hub__welcome">
              <p className="office-hub__greeting">
                <span className="office-hub__greeting-label" suppressHydrationWarning>
                  {greeting},
                </span>{" "}
                <span className="office-hub__greeting-name">{displayLabel}</span>
              </p>

              <p className="office-hub__clock" aria-live="polite">
                <span className="office-hub__clock-main" suppressHydrationWarning>
                  {clock.hour}:{clock.minute}
                </span>
                <span className="office-hub__clock-ampm" suppressHydrationWarning>
                  {clock.dayPeriod}
                </span>
              </p>

              <p className="office-hub__date" suppressHydrationWarning>
                {formatDateLine(now)} · {OFFICE_LOCATION}
              </p>

              <GlobalSearchBar className="mx-auto mt-4 w-full max-w-xl" />
              <WorkspaceBreadcrumb page="Home" className="mx-auto mt-3 max-w-xl justify-center" />

              <MyWorkHubSummary
                summary={summary}
                billingAccess={billingAccess}
                loading={summaryLoading}
                tasksHref={tasksHref}
                billingHref={billingHref}
              />

              <NewStaffHint email={hubUser.email} />
              <HubRoleShortcuts
                billingAccess={billingAccess}
                isAdmin={hubUser.isAdmin}
                secretaryNav={secretaryNav}
              />
            </section>

            <section
              className={`office-hub__launchers${billingAccess ? "" : " office-hub__launchers--single"}`}
              aria-label="Open a workspace"
            >
              <SameWindowLink
                href={tasksHref}
                className={launcherClass("office-hub__launcher office-hub__launcher--tasks", "tasks", lastWorkspace)}
                onClick={() => rememberWorkspace("tasks")}
              >
              <div className="office-hub__launcher-inner">
                <span className="office-hub__launcher-title">Schedule</span>
                <span className="office-hub__launcher-desc">Deadlines, hearings, assignments</span>
              </div>
              <span className="office-hub__launcher-cta">Open</span>
              </SameWindowLink>

              {billingAccess ? (
                <SameWindowLink
                  href={billingHref}
                  className={launcherClass("office-hub__launcher office-hub__launcher--billing", "billing", lastWorkspace)}
                  onClick={() => rememberWorkspace("billing")}
                >
                  <div className="office-hub__launcher-inner">
                    <span className="office-hub__launcher-title">Accounts</span>
                    <span className="office-hub__launcher-desc">Clients, entries, statements</span>
                  </div>
                  <span className="office-hub__launcher-cta">Open</span>
                </SameWindowLink>
              ) : null}
            </section>

            <p className="office-hub__help">
              <SameWindowLink href="/office-hub/instructions" className="office-hub__help-link">
                Office procedures
              </SameWindowLink>
            </p>

            <OfficeHubPwaHint />
          </main>

          <footer className="office-hub__footer">
            <p className="office-hub__footer-brand">Hernandez &amp; Associates</p>
            <p className="office-hub__footer-confidential">
              Confidential — Hernandez &amp; Associates · for authorized staff only
            </p>
            <FirmCopyright className="office-hub__footer-copyright" />
          </footer>
        </div>
      </div>
    </ClientMatterProvider>
  );
}
