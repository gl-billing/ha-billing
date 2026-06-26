"use client";

import { StatTile } from "@/components/office-tasks/PremiumUI";

type Counts = {
  waitingAndStarted: number;
  overdueOpen: number;
  tasksDueToday: number;
  eventsToday: number;
  deadlinesToday: number;
  completedToday: number;
};

type Props = {
  counts: Counts;
  onJump: (sectionId: string) => void;
  compact?: boolean;
};

export function TodayWorkStatGrid({ counts, onJump, compact = false }: Props) {
  const dueToday = counts.tasksDueToday + counts.eventsToday + counts.deadlinesToday;

  return (
    <section
      className={`today-work-stats today-work-stats--simple no-print ${compact ? "today-work-stats--compact" : ""}`.trim()}
      aria-label="Today's workload"
    >
      <div className="today-work-stats__grid today-work-stats__grid--equal">
        <StatTile
          layout="center"
          label="Due first"
          value={counts.overdueOpen}
          variant={counts.overdueOpen > 0 ? "red" : "muted"}
          onClick={() => onJump("today-overdue")}
        />
        <StatTile
          layout="center"
          label="Due today"
          value={dueToday}
          variant="blue"
          onClick={() => onJump("today-due")}
        />
        <StatTile
          layout="center"
          label="Waiting"
          value={counts.waitingAndStarted}
          variant="sage"
          onClick={() => onJump("today-waiting")}
        />
        <StatTile
          layout="center"
          label="Completed today"
          value={counts.completedToday}
          variant="gold"
          onClick={() => onJump("today-done")}
        />
      </div>
    </section>
  );
}
