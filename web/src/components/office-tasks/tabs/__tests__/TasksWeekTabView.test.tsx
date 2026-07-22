// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TasksWeekTabView } from "@/components/office-tasks/tabs/TasksWeekTabView";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

vi.mock("@/components/office-tasks/DayScheduleView", () => ({
  DayScheduleView: () => <div data-testid="day-schedule-view">Day schedule</div>
}));

vi.mock("@/components/office-tasks/WeeklyPlannerView", () => ({
  WeeklyPlannerView: () => <div data-testid="week-planner-view">Week planner</div>
}));

const items: OfficeItem[] = [];

describe("TasksWeekTabView", () => {
  it("renders day schedule in day calendar mode", () => {
    render(
      <TasksWeekTabView calendarMode="day" items={items} today="2026-07-22" weekStart="2026-07-20" />
    );
    expect(screen.getByTestId("day-schedule-view")).toBeInTheDocument();
    expect(screen.getByText("About day schedule")).toBeInTheDocument();
  });

  it("renders week planner in week calendar mode", () => {
    render(
      <TasksWeekTabView calendarMode="week" items={items} today="2026-07-22" weekStart="2026-07-20" />
    );
    expect(screen.getByTestId("week-planner-view")).toBeInTheDocument();
    expect(screen.getAllByText("Week planner").length).toBeGreaterThan(0);
  });
});
