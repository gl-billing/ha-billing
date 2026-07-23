"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  buildClioHref,
  clioPrimariesForUser,
  defaultClioSectionForUser,
  findClioPrimary,
  readSavedClioNav,
  type ClioNavId,
  type ClioPrimary
} from "@/lib/clio/workspace-nav";
import { resolveNavUserProfile } from "@/lib/workspace-labels";

const OFFICE_LOCATION = "Philippines";
const tasksHref = firmAppHref("/app");
const billingHref = "/billing";

/** Hub overview — Clio primaries staff jump into most often (rail remains full nav). */
const HUB_PRIMARY_ORDER: ClioNavId[] = [
  "checklist",
  "calendar",
  "matters",
  "billing",
  "activities",
  "documents"
];

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
  notice?: string;
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

function resolveDeskEntry(billingAccess: boolean): { href: string; workspace: WorkspaceId; label: string } {
  const saved = readSavedClioNav();
  if (saved) {
    const primary = findClioPrimary(saved.nav);
    if (primary.app === "billing" && !billingAccess) {
      /* fall through */
    } else {
      return {
        href: buildClioHref(saved.nav, saved.section || primary.defaultSectionId),
        workspace: primary.app === "billing" ? "billing" : "tasks",
        label: primary.label
      };
    }
  }

  const last = getAllowedLastWorkspace(billingAccess);
  if (last === "billing" && billingAccess) {
    const primary = findClioPrimary("billing");
    return {
      href: buildClioHref("billing", primary.defaultSectionId),
      workspace: "billing",
      label: primary.label
    };
  }

  const primary = findClioPrimary("checklist");
  return {
    href: buildClioHref("checklist", primary.defaultSectionId),
    workspace: "tasks",
    label: primary.label
  };
}

function hubPrimariesForUser(
  primaries: ClioPrimary[],
  visibility: Parameters<typeof clioPrimariesForUser>[0]
): Array<{ id: ClioNavId; label: string; description: string; href: string; workspace: WorkspaceId }> {
  const byId = new Map(primaries.map((p) => [p.id, p]));
  const ordered: ClioPrimary[] = [];
  for (const id of HUB_PRIMARY_ORDER) {
    const primary = byId.get(id);
    if (primary) ordered.push(primary);
  }
  return ordered.map((primary) => {
    const section = defaultClioSectionForUser(primary, visibility);
    return {
      id: primary.id,
      label: primary.label,
      description: primary.description,
      href: buildClioHref(primary.id, section.id),
      workspace: primary.app === "billing" ? "billing" : "tasks"
    };
  });
}

export function OfficeHubLauncher({ initialSummary, hubUser, notice }: Props) {
  const billingAccess = hubUser.billingAccess;
  const displayLabel = formatStaffDisplayName(hubUser.name, hubUser.email) || "team";
  const searchParams = useSearchParams();
  const showBillingRestricted =
    notice === "billing-restricted" || searchParams.get("notice") === "billing-restricted";
  useStaffPresenceHeartbeat({ workspace: "hub" });

  const [now, setNow] = useState(() => new Date());
  const [deskEntry, setDeskEntry] = useState<{ href: string; workspace: WorkspaceId; label: string }>(() => ({
    href: buildClioHref("checklist", "today"),
    workspace: "tasks",
    label: "My work"
  }));
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
    setDeskEntry(resolveDeskEntry(billingAccess));
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

  const navProfile = useMemo(
    () =>
      resolveNavUserProfile({
        email: hubUser.email,
        billingAccess,
        secretaryNav
      }),
    [billingAccess, hubUser.email, secretaryNav]
  );

  const visibility = useMemo(
    () => ({
      billingAccess,
      navProfile,
      isAdmin: hubUser.isAdmin,
      email: hubUser.email
    }),
    [billingAccess, hubUser.email, hubUser.isAdmin, navProfile]
  );

  const deskPrimaries = useMemo(() => {
    const allowed = clioPrimariesForUser(visibility);
    return hubPrimariesForUser(allowed, visibility);
  }, [visibility]);

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

            {showBillingRestricted ? (
              <aside className="office-hub__access-note" role="status">
                <p className="office-hub__access-note-text">
                  Your account is Tasks &amp; calendar only. Accounts / billing is limited to office
                  administrators and desk staff.
                </p>
              </aside>
            ) : null}

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

            <section className="office-hub__desk" aria-label="Firm desk">
              <SameWindowLink
                href={deskEntry.href}
                className="office-hub__desk-enter"
                onClick={() => rememberWorkspace(deskEntry.workspace)}
              >
                <div className="office-hub__desk-enter-inner">
                  <span className="office-hub__desk-enter-eyebrow">Firm desk</span>
                  <span className="office-hub__desk-enter-title">Open workspace</span>
                  <span className="office-hub__desk-enter-desc">
                    One desk with My work, calendar, matters, and billing — continue in {deskEntry.label}
                  </span>
                </div>
                <span className="office-hub__desk-enter-cta">Open</span>
              </SameWindowLink>

              {deskPrimaries.length ? (
                <nav className="office-hub__desk-primaries" aria-label="Jump into desk">
                  <p className="office-hub__desk-primaries-label">Jump to</p>
                  <ul className="office-hub__desk-primaries-list">
                    {deskPrimaries.map((item) => (
                      <li key={item.id}>
                        <SameWindowLink
                          href={item.href}
                          className="office-hub__desk-primary"
                          title={item.description}
                          onClick={() => rememberWorkspace(item.workspace)}
                        >
                          <span className="office-hub__desk-primary-label">{item.label}</span>
                        </SameWindowLink>
                      </li>
                    ))}
                  </ul>
                </nav>
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
