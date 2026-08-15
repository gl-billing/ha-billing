"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OfficeItemDetailHost } from "@/components/office-tasks/OfficeItemDetailHost";
import { SameWindowLink } from "@/components/SameWindowLink";
import type { ComponentProps } from "react";
import { formatStaffDisplayName } from "@/lib/user-display";
import {
  buildMobileOfficeLists,
  itemsForMobileOfficeView,
  mobileHomeTaskRows,
  mobileOfficeBackHref,
  mobileOfficeCardHref,
  mobileOfficeEmptyCopy,
  mobileOfficeItemHref,
  mobileOfficeItemSubtitle,
  mobileOfficeItemTitle,
  parseMobileOfficeView,
  withSearchParams,
  type MobileOfficeView
} from "@/lib/mobile-office-views";
import {
  getMondayOfWeekYmd,
  getWeekDatesYmd,
  todayYmd,
  ymdToUtcDate
} from "@/lib/office-tasks/date-only";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { tasksHref } from "@/lib/tasks-routes";
import styles from "./MobileHome.module.css";

type DetailHandlers = Omit<ComponentProps<typeof OfficeItemDetailHost>, "item" | "onClose" | "allItems">;

type Props = {
  items?: OfficeItem[];
  itemsReady?: boolean;
  handlers?: DetailHandlers;
};

type CardIcon = "calendar" | "check" | "file" | "people" | "bell";

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function greetingNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function greetingWithName(when: string, name: string): string {
  const label = name.trim();
  if (!label || label.toLowerCase() === "there") return `${when}!`;
  return `${when}, ${label}!`;
}

function CardGlyph({ icon }: { icon: CardIcon }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  if (icon === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    );
  }
  if (icon === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M8.2 12.2 10.8 14.8 15.8 9.4" />
      </svg>
    );
  }
  if (icon === "file") {
    return (
      <svg {...common}>
        <path d="M7 3.75h7.2L19.5 9v11.25H7z" />
        <path d="M14.1 3.75V9H19.5M9.2 13.2h5.8M9.2 16.6h4.2" />
      </svg>
    );
  }
  if (icon === "people") {
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
      <path d="M6.5 9.4a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.4 1.5 5.4H5s1.5-1.2 1.5-5.4Z" />
      <path d="M10.2 18.4a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}

function DateStrip({
  week,
  selectedDate,
  onSelect
}: {
  week: Array<{ ymd: string; weekday: string; day: number }>;
  selectedDate: string;
  onSelect: (ymd: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !week.length) return;
    const cards = Array.from(scroller.querySelectorAll<HTMLElement>("[data-date-card]"));
    if (!cards.length) return;
    const index = Math.max(
      0,
      week.findIndex((day) => day.ymd === selectedDate)
    );
    const visible = 5;
    const maxStart = Math.max(0, cards.length - visible);
    const startIndex = Math.min(maxStart, Math.max(0, index - 2));
    const target = cards[startIndex];
    if (!target) return;
    const left = Math.max(0, target.offsetLeft);
    scroller.scrollLeft = left;
  }, [selectedDate, week]);

  return (
    <div ref={scrollerRef} className={styles.dates} role="listbox" aria-label="This week">
      {week.map((day) => {
        const selected = day.ymd === selectedDate;
        return (
          <button
            key={day.ymd}
            type="button"
            role="option"
            aria-selected={selected}
            data-date-card=""
            className={`${styles.date}${selected ? ` ${styles.dateActive}` : ""}`}
            onClick={() => onSelect(day.ymd)}
          >
            <span className={styles.dateWeekday}>{day.weekday}</span>
            <span className={styles.dateNum}>{day.day}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MobileHome({ items: itemsProp, itemsReady = itemsProp !== undefined, handlers }: Props) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const today = todayYmd();
  const dayParam = (searchParams.get("day") || "").trim();
  const view = parseMobileOfficeView(searchParams.get("mo"));
  const itemId = (searchParams.get("moItem") || "").trim();
  const [selectedDate, setSelectedDate] = useState(dayParam || today);
  const [noticeCount, setNoticeCount] = useState<number | null>(null);
  const [fetchedItems, setFetchedItems] = useState<OfficeItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const { data: session } = useSession();
  const greetingName =
    session?.user?.displayName || formatStaffDisplayName(session?.user?.name, session?.user?.email);
  const [greeting, setGreeting] = useState("Hello");
  const [online, setOnline] = useState(true);
  const homeHref = tasksHref({ tab: "desk-checklist" });

  const week = useMemo(() => {
    const dates = getWeekDatesYmd(getMondayOfWeekYmd(today));
    return dates.map((ymd) => {
      const utc = ymdToUtcDate(ymd);
      return {
        ymd,
        weekday: WEEKDAY_SHORT[utc.getUTCDay()] || "",
        day: utc.getUTCDate(),
        isToday: ymd === today
      };
    });
  }, [today]);

  useEffect(() => {
    if (dayParam && dayParam !== selectedDate) setSelectedDate(dayParam);
  }, [dayParam, selectedDate]);

  useEffect(() => {
    setGreeting(greetingWithName(greetingNow(), greetingName || ""));
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [greetingName]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const list = Array.isArray(json.notifications) ? json.notifications : [];
        setNoticeCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setNoticeCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (itemsProp !== undefined) return;
    let cancelled = false;
    void fetch("/api/tasks/home")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load office items.");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setFetchedItems(Array.isArray(json.items) ? json.items : []);
        setLoadError("");
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedItems([]);
          setLoadError("Could not load today’s office.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [itemsProp]);

  const items = useMemo(() => itemsProp ?? fetchedItems ?? [], [itemsProp, fetchedItems]);
  const ready = itemsProp !== undefined ? itemsReady : fetchedItems !== null;
  const lists = useMemo(
    () => buildMobileOfficeLists(items, selectedDate, today),
    [items, selectedDate, today]
  );
  const dayIsToday = selectedDate === today;
  const dayForHref = dayIsToday ? null : selectedDate;
  const noticesBase = tasksHref({ tab: "today" });
  const noticesHref = `${noticesBase}${noticesBase.includes("?") ? "&" : "?"}space=notifications`;
  const addTaskHref = withSearchParams(tasksHref({ tab: "add-task" }), {
    day: dayForHref
  });
  const addEventHref = withSearchParams(tasksHref({ tab: "add-event" }), {
    day: dayForHref
  });

  function selectDay(ymd: string) {
    setSelectedDate(ymd);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "desk-checklist");
    if (ymd === today) next.delete("day");
    else next.set("day", ymd);
    next.delete("mo");
    next.delete("moItem");
    next.delete("moFrom");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const stackView: Exclude<MobileOfficeView, "notifications"> | null =
    view && view !== "notifications" ? view : null;
  const taskRows = mobileHomeTaskRows(lists, dayIsToday);
  const stackRows = stackView
    ? stackView === "tasks"
      ? taskRows
      : itemsForMobileOfficeView(lists, stackView)
    : [];
  const detailItem = itemId ? stackRows.find((row) => row.id === itemId) || items.find((row) => row.id === itemId) : null;
  const showDetail = Boolean(stackView && itemId);
  const showList = Boolean(stackView && !itemId);
  const closeDetailHref = mobileOfficeBackHref(homeHref, searchParams.toString());

  function recordSubtitle(rows: OfficeItem[], emptyToday: string, emptyOther: string, one: string, many: string): string {
    if (!ready) return "Loading…";
    if (rows.length === 1) return mobileOfficeItemTitle(rows[0]);
    if (rows.length) return countLabel(rows.length, one, many);
    return dayIsToday ? emptyToday : emptyOther;
  }

  const cards: Array<{
    title: string;
    subtitle: string;
    href: string;
    icon: CardIcon;
    unread?: boolean;
  }> = [
    {
      title: "Schedule",
      subtitle: recordSubtitle(
        lists.schedule,
        "0 events today",
        "No events this day",
        dayIsToday ? "event today" : "event",
        dayIsToday ? "events today" : "events"
      ),
      href: mobileOfficeCardHref(homeHref, "schedule", lists.schedule, dayForHref),
      icon: "calendar"
    },
    {
      title: "Tasks",
      subtitle: ready
        ? lists.overdue.length
          ? `${countLabel(lists.tasksDue.length, "task due", "tasks due")} · ${countLabel(
              lists.overdue.length,
              "overdue",
              "overdue"
            )}`
          : recordSubtitle(taskRows, "0 tasks due", "No tasks this day", "task due", "tasks due")
        : "Loading…",
      href: mobileOfficeCardHref(homeHref, "tasks", taskRows, dayForHref),
      icon: "check"
    },
    {
      title: "Filing Deadline",
      subtitle: recordSubtitle(
        lists.filing,
        "No deadlines today",
        "No deadlines this day",
        "deadline",
        "deadlines"
      ),
      href: mobileOfficeCardHref(homeHref, "filing", lists.filing, dayForHref),
      icon: "file"
    },
    {
      title: "Client Meeting",
      subtitle: recordSubtitle(
        lists.meeting,
        "No client meetings scheduled",
        "No client meetings scheduled",
        "meeting",
        "meetings"
      ),
      href: mobileOfficeCardHref(homeHref, "meeting", lists.meeting, dayForHref),
      icon: "people"
    },
    {
      title: "Notifications",
      subtitle:
        noticeCount == null
          ? "Loading…"
          : noticeCount
            ? countLabel(noticeCount, "new update", "new updates")
            : "No new updates",
      href: noticesHref,
      icon: "bell",
      unread: Boolean(noticeCount)
    }
  ];

  return (
    <section className={`ha-mobile-app ${styles.shell}`} aria-label="Today’s Office">
      {!showDetail && !showList ? (
        <>
          <p className={styles.greeting}>{greeting}</p>
          <h1 className={styles.title}>Today’s Office</h1>
        </>
      ) : (
        <h1 className={styles.listTitle}>
          {stackView
            ? stackView === "meeting"
              ? "Client Meeting"
              : stackView === "filing"
                ? "Filing Deadline"
                : stackView === "tasks"
                  ? "Tasks"
                  : "Schedule"
            : "Today’s Office"}
        </h1>
      )}

      {!online ? <p className={styles.status}>You’re offline. Counts will refresh when you’re back online.</p> : null}
      {loadError ? <p className={styles.status}>{loadError}</p> : null}

      <DateStrip week={week} selectedDate={selectedDate} onSelect={selectDay} />

      {showDetail && detailItem && handlers ? (
        <OfficeItemDetailHost
          item={detailItem}
          onClose={() => router.push(closeDetailHref)}
          allItems={items}
          {...handlers}
        />
      ) : null}

      {showDetail && itemId && !detailItem && ready ? (
        <div className={styles.empty}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className={styles.emptyLogo} />
          <p className={styles.emptyCopy}>This record is not on the selected day.</p>
        </div>
      ) : null}

      {showList && stackView ? (
        stackRows.length ? (
          <ul className={styles.list}>
            {stackRows.map((row) => (
              <li key={row.id}>
                <SameWindowLink
                  href={mobileOfficeItemHref(homeHref, stackView, row.id, dayForHref)}
                  className={styles.card}
                >
                  <span className={styles.copy}>
                    <span className={styles.cardTitle}>{mobileOfficeItemTitle(row)}</span>
                    <span className={styles.cardSub}>{mobileOfficeItemSubtitle(row) || row.date}</span>
                  </span>
                  <span className={styles.meta}>
                    <span className={styles.chevron} aria-hidden>
                      ›
                    </span>
                  </span>
                </SameWindowLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="" className={styles.emptyLogo} />
            <p className={styles.emptyCopy}>{mobileOfficeEmptyCopy(stackView, dayIsToday)}</p>
          </div>
        )
      ) : null}

      {!showDetail && !showList ? (
        <>
          <ul className={styles.cards}>
            {cards.map((card) => (
              <li key={card.title}>
                <SameWindowLink href={card.href} className={styles.card}>
                  <span className={styles.icon}>
                    <CardGlyph icon={card.icon} />
                  </span>
                  <span className={styles.copy}>
                    <span className={styles.cardTitle}>{card.title}</span>
                    <span className={styles.cardSub}>{card.subtitle}</span>
                  </span>
                  <span className={styles.meta}>
                    {card.unread ? <span className={styles.dot} aria-hidden /> : null}
                    <span className={styles.chevron} aria-hidden>
                      ›
                    </span>
                  </span>
                </SameWindowLink>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <SameWindowLink href={addTaskHref} className={styles.add}>
              + Add Task
            </SameWindowLink>
            <SameWindowLink href={addEventHref} className={styles.add}>
              + Add Event
            </SameWindowLink>
          </div>
        </>
      ) : null}
    </section>
  );
}
