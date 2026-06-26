"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { Skeleton } from "@/components/Skeleton";
import { SameWindowLink } from "@/components/SameWindowLink";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import { BIRTHDAYS_REFRESH_EVENT } from "@/components/TodayBirthdaysProvider";
import { matterHref } from "@/lib/matter-routes";
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
  markFiledAction?: FirmNotificationMarkFiledAction;
};

type Props = {
  /** Smaller bell for the brand header toolbar */
  compact?: boolean;
};

type PanelPosition = {
  top: number;
  right: number;
};

const SECTION_LABELS: Record<FirmNotificationKind, string> = {
  birthday: "Birthdays today",
  "filing-due": "Filings due today",
  "hearing-today": "Hearings today",
  "prep-ready": "Prep ready for filing"
};

export function NotificationsCenter({ compact = false }: Props) {
  const { withReturn } = useMatterNavigation();
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications").catch(() => null);
      if (!res?.ok) {
        setNotices([]);
        setIsAdmin(false);
        return;
      }
      const json = await res.json();
      setIsAdmin(json.isAdmin === true);
      const list: Notice[] = (json.notifications || []).map(
        (row: {
          id: string;
          kind: FirmNotificationKind;
          title: string;
          subtitle: string;
          clientCode: string;
          markFiledAction?: FirmNotificationMarkFiledAction;
        }) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          subtitle: row.subtitle,
          href: matterHref(row.clientCode || "APP"),
          markFiledAction: row.markFiledAction
        })
      );
      setNotices(list.slice(0, 24));
    } finally {
      setLoading(false);
    }
  }, []);

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
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not mark filed.");
        await load();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not mark filed.");
      } finally {
        setMarkingId(null);
      }
    },
    [load, markingId]
  );

  const updatePanelPosition = useCallback(() => {
    const bell = bellRef.current;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    const viewportPad = 8;
    const measuredWidth = panelRef.current?.getBoundingClientRect().width;
    const panelWidth =
      measuredWidth && measuredWidth > 0
        ? measuredWidth
        : Math.min(320, window.innerWidth - viewportPad * 2);
    const alignRight = Math.max(viewportPad, window.innerWidth - rect.right);
    const maxRight = Math.max(viewportPad, window.innerWidth - panelWidth - viewportPad);

    setPanelPosition({
      top: rect.bottom + 6,
      right: Math.min(alignRight, maxRight)
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  useEffect(() => {
    function onBirthdaysRefresh() {
      void load();
    }

    window.addEventListener(BIRTHDAYS_REFRESH_EVENT, onBirthdaysRefresh);
    return () => window.removeEventListener(BIRTHDAYS_REFRESH_EVENT, onBirthdaysRefresh);
  }, [load]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }
    updatePanelPosition();
    const frame = requestAnimationFrame(() => updatePanelPosition());
    return () => cancelAnimationFrame(frame);
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    function onScrollOrResize() {
      updatePanelPosition();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, updatePanelPosition]);

  const count = notices.length;
  const kinds: FirmNotificationKind[] = ["birthday", "filing-due", "hearing-today", "prep-ready"];

  function showMarkFiledButton(notice: Notice): boolean {
    return isAdmin && Boolean(notice.markFiledAction) && (notice.kind === "filing-due" || notice.kind === "prep-ready");
  }

  const panel =
    open && panelPosition && mounted ? (
      <div
        ref={panelRef}
        className="notifications-center__panel notifications-center__panel--floating"
        style={{ top: panelPosition.top, right: panelPosition.right }}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="notifications-center__head">
          <p className="notifications-center__title font-display text-base font-semibold text-ink">
            Notifications
          </p>
          <button type="button" className="text-xs text-muted" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        {loading ? (
          <div className="px-3 py-4">
            <Skeleton lines={3} />
          </div>
        ) : null}
        {!loading && notices.length === 0 ? (
          <div className="px-3 py-2">
            <EmptyState message="All quiet — no birthdays, filings, or hearings to flag today." />
          </div>
        ) : null}
        <ul className="notifications-center__list">
          {!loading
            ? kinds.flatMap((kind) => {
                const section = notices.filter((notice) => notice.kind === kind);
                if (!section.length) return [];
                return [
                  <li
                    key={`${kind}-label`}
                    className="notifications-center__section-label notifications-center__section-label--serif"
                  >
                    {SECTION_LABELS[kind]}
                  </li>,
                  ...section.map((notice) => (
                    <li
                      key={notice.id}
                      className={`notifications-center__row ${
                        notice.kind === "birthday"
                          ? "notifications-center__row--birthday"
                          : notice.kind === "filing-due" || notice.kind === "prep-ready"
                            ? "notifications-center__row--urgent"
                            : ""
                      }`.trim()}
                    >
                      <SameWindowLink
                        href={withReturn(notice.href)}
                        className="notifications-center__item notifications-center__item--link"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm font-bold text-ink">{notice.title}</p>
                        <p className="text-[11px] text-muted">{notice.subtitle}</p>
                      </SameWindowLink>
                      {showMarkFiledButton(notice) ? (
                        <button
                          type="button"
                          className="notifications-center__mark-filed"
                          disabled={markingId === notice.id}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void markFiled(notice);
                          }}
                        >
                          {markingId === notice.id ? "…" : "Mark filed"}
                        </button>
                      ) : null}
                    </li>
                  ))
                ];
              })
            : null}
        </ul>
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={`notifications-center no-print ${compact ? "notifications-center--compact" : ""}`.trim()}
    >
      <button
        ref={bellRef}
        type="button"
        className={`notifications-center__bell ${compact ? "notifications-center__bell--compact" : ""}`.trim()}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        🔔
        {count ? <span className="notifications-center__badge">{count > 9 ? "9+" : count}</span> : null}
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
