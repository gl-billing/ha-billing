// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayScheduleView } from "@/components/office-tasks/DayScheduleView";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

const today = "2026-07-22";

function item(partial: Partial<OfficeItem>): OfficeItem {
  return {
    source: "Event",
    rowNumber: 1,
    id: partial.id || "E1",
    date: partial.date || today,
    clientCase: partial.clientCase || "SMITH",
    details: partial.details || "Hearing",
    status: partial.status || "Open",
    done: partial.done ?? false,
    assignedTo: partial.assignedTo || "Atty",
    startTime: partial.startTime ?? null,
    endTime: null,
    category: "Hearing",
    ...partial
  } as OfficeItem;
}

describe("DayScheduleView", () => {
  it("renders hourly grid labels", () => {
    render(<DayScheduleView items={[]} today={today} />);
    expect(screen.getByText("7:00 AM")).toBeInTheDocument();
    expect(screen.getByText("8:00 PM")).toBeInTheDocument();
  });

  it("places timed items in hour lanes", () => {
    render(
      <DayScheduleView
        items={[item({ id: "E-hearing", startTime: "9:30 AM", category: "Hearing" })]}
        today={today}
      />
    );
    expect(screen.getByText(/9:30 AM · Hearing/)).toBeInTheDocument();
  });

  it("lists untimed items separately", () => {
    render(
      <DayScheduleView
        items={[item({ id: "T1", startTime: null, details: "Draft pleading" })]}
        today={today}
      />
    );
    expect(screen.getByText("Untimed")).toBeInTheDocument();
    expect(screen.getByText(/Draft pleading/)).toBeInTheDocument();
  });
});
