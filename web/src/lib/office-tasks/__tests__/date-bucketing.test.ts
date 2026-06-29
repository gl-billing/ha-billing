import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeTodayCounts, filterTodayLists } from "@/lib/office-tasks/today-lists";
import { bucketItemsForDay, getWeekPlan, getWeekDates, getMondayOfWeek } from "@/lib/office-tasks/schedule";
import { makeItem } from "@/lib/office-tasks/__tests__/fixtures";

const TODAY = "2026-06-11";
const WEEK_START = getMondayOfWeek(TODAY);
const WEEK_DATES = getWeekDates(WEEK_START);

vi.mock("@/lib/office-tasks/date-only", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/office-tasks/date-only")>();
  return { ...actual, todayYmd: () => TODAY };
});

describe("date bucketing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts overdue, due today, due this week, and waiting separately", () => {
    const counts = computeTodayCounts([
      makeItem({ id: "T-1", date: "2026-06-09", status: "In Progress" }),
      makeItem({ id: "T-2", source: "Event", category: "Hearing", date: TODAY }),
      makeItem({ id: "T-3", source: "Event", category: "Court Filing", date: TODAY }),
      makeItem({ id: "T-4", status: "Waiting", date: "2026-06-20" }),
      makeItem({ id: "T-5", done: true, completedDate: TODAY }),
      makeItem({ id: "T-6", date: "2026-06-13", status: "In Progress" })
    ]);

    expect(counts.overdueOpen).toBe(1);
    expect(counts.eventsToday).toBe(1);
    expect(counts.deadlinesToday).toBe(1);
    expect(counts.dueThisWeek).toBe(1);
    expect(counts.waitingAndStarted).toBe(1);
    expect(counts.completedToday).toBe(1);
  });

  it("lists due-this-week items separately from due today", () => {
    const lists = filterTodayLists([
      makeItem({ id: "T-1", date: TODAY }),
      makeItem({ id: "T-2", date: "2026-06-13", status: "In Progress" }),
      makeItem({ id: "T-3", date: "2026-06-20", status: "In Progress" })
    ]);

    expect(lists.tasksDueToday.map((i) => i.id)).toEqual(["T-1"]);
    expect(lists.dueThisWeek.map((i) => i.id)).toEqual(["T-2"]);
    expect(lists.dueThisWeek.some((i) => i.id === "T-3")).toBe(false);
  });

  it("puts waiting items in follow-up list, not overdue", () => {
    const lists = filterTodayLists([
      makeItem({ id: "T-1", status: "Waiting", date: "2026-06-09" }),
      makeItem({ id: "T-2", date: "2026-06-09", status: "In Progress" })
    ]);

    expect(lists.waitingAndStarted.map((i) => i.id)).toEqual(["T-1"]);
    expect(lists.overdue.map((i) => i.id)).toEqual(["T-2"]);
  });

  it("buckets day detail into overdue, hearings, filings, and tasks", () => {
    const buckets = bucketItemsForDay(
      [
        makeItem({ id: "T-1", date: "2026-06-09" }),
        makeItem({ id: "E-1", source: "Event", category: "Hearing", date: TODAY }),
        makeItem({ id: "E-2", source: "Event", category: "Court Filing", date: TODAY }),
        makeItem({ id: "T-2", date: TODAY }),
        makeItem({ id: "T-3", done: true, status: "Done" })
      ],
      TODAY,
      TODAY
    );

    expect(buckets.overdue.map((i) => i.id)).toEqual(["T-1"]);
    expect(buckets.events.map((i) => i.id)).toEqual(["E-1"]);
    expect(buckets.deadlines.map((i) => i.id)).toEqual(["E-2"]);
    expect(buckets.tasks.map((i) => i.id)).toEqual(["T-2"]);
    expect(buckets.done.map((i) => i.id)).toEqual(["T-3"]);
  });

  it("keeps waiting items only on their assigned day in the week plan", () => {
    const waitingDay = WEEK_DATES[2];
    const plan = getWeekPlan(
      [
        makeItem({ id: "T-1", status: "Waiting", date: waitingDay }),
        makeItem({ id: "T-2", date: "2026-06-09", status: "In Progress" }),
        makeItem({ id: "T-3", date: WEEK_DATES[3], status: "In Progress" })
      ],
      WEEK_DATES,
      TODAY
    );

    expect(plan.overdue.map((i) => i.id)).toEqual(["T-2"]);
    expect(plan.byDay[2].map((i) => i.id)).toEqual(["T-1"]);
    expect(plan.byDay[3].map((i) => i.id)).toEqual(["T-3"]);
    expect(plan.byDay[0]).toHaveLength(0);
  });
});
