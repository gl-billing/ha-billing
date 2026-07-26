"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { Skeleton } from "@/components/Skeleton";
import { SameWindowLink } from "@/components/SameWindowLink";
import { matterHref } from "@/lib/matter-routes";
import { billingHref } from "@/lib/billing-routes";
import { tasksHref } from "@/lib/tasks-routes";
import type {
  FirmNotificationKind,
  FirmNotificationMarkFiledAction
} from "@/lib/office-tasks/firm-notifications";

type Notice = {
  id: string;
  kind: FirmNotificationKind;
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  markFiledAction?: FirmNotificationMarkFiledAction;
};

const SECTION_LABELS: Record<FirmNotificationKind, string> = {
  birthday: "Birthdays today",
  "filing-due": "Filings due today",
  "hearing-today": "Hearings today",
  "prep-ready": "Prep ready for filing"
};

function noticeLink(kind: FirmNotificationKind, clientCode?: string): { href: string; label: string } {
  const code = (clientCode || "").trim();
  const hasMatter = Boolean(code) && code.toUpperCase() !== "APP";
  if (kind === "birthday" && hasMatter) {
    return { href: matterHref(code), label: "Open matter / greeting" };
  }
  if (kind === "birthday") {
    return { href: billingHref({ page: "clients" }), label: "Open clients" };
  }
  if ((kind === "filing-due" || kind === "prep-ready") && hasMatter) {
    return { href: matterHref(code), label: "Open matter" };
  }
  if (kind === "filing-due" || kind === "prep-ready") {
    return { href: tasksHref({ tab: "filing" }), label: "Open filing queues" };
  }
  if (kind === "hearing-today" && hasMatter) {
    return { href: matterHref(code), label: "Open matter" };
  }
  return { href: tasksHref({ tab: "desk-checklist" }), label: "Open today’s desk" };
}

/** Space Notifications desk — firm alerts from /api/notifications. */
export function SpaceNotificationsDesk() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications");
      const json = (await res.json().catch(() => ({}))) as {
        isAdmin?: boolean;
        notifications?: Array<{
          id: string;
          kind: FirmNotificationKind;
          title: string;
          subtitle: string;
          clientCode?: string;
          markFiledAction?: FirmNotificationMarkFiledAction;
        }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not load notifications.");
      setIsAdmin(json.isAdmin === true);
      setNotices(
        (json.notifications || []).map((row) => {
          const link = noticeLink(row.kind, row.clientCode);
          return {
            id: row.id,
            kind: row.kind,
            title: row.title,
            subtitle: row.subtitle,
            href: link.href,
            linkLabel: link.label,
            markFiledAction: row.markFiledAction
          };
        })
      );
    } catch (err) {
      setNotices([]);
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markFiled = useCallback(
    async (notice: Notice) => {
      const action = notice.markFiledAction;
      if (!action || markingId) return;
      setMarkingId(notice.id);
      try {
        const res = await fetch("/api/tasks/items/submitted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...action, submitted: true })
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not mark filed.");
        await load();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not mark filed.");
      } finally {
        setMarkingId(null);
      }
    },
    [load, markingId]
  );

  const canMarkFiled = (notice: Notice) =>
    isAdmin &&
    Boolean(notice.markFiledAction) &&
    (notice.kind === "filing-due" || notice.kind === "prep-ready");

  return (
    <section className="space-notifications-desk card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Notifications</p>
          <h2 className="text-lg font-semibold text-ink">Alerts & follow-ups</h2>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      {!loading && !error && notices.length === 0 ? (
        <EmptyState title="All clear" message="No firm alerts right now." />
      ) : null}
      {!loading && notices.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {notices.map((n) => (
            <li key={n.id} className="border border-[color:var(--line)] bg-[color:var(--paper)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {SECTION_LABELS[n.kind] || n.kind}
              </p>
              <p className="mt-1 font-medium text-ink">{n.title}</p>
              {n.subtitle ? <p className="mt-1 text-sm text-muted">{n.subtitle}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <SameWindowLink href={n.href} className="text-sm underline">
                  {n.linkLabel}
                </SameWindowLink>
                {canMarkFiled(n) ? (
                  <button
                    type="button"
                    className="btn-secondary !text-xs"
                    disabled={markingId === n.id}
                    onClick={() => void markFiled(n)}
                  >
                    {markingId === n.id ? "Marking…" : "Mark filed"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
