"use client";

type Props = {
  onSelect: (kind: "task" | "event") => void;
};

export function TaskEventChooser({ onSelect }: Props) {
  return (
    <section className="task-event-chooser" aria-label="Choose entry type">
      <header className="task-event-chooser__head">
        <h2 className="task-event-chooser__title">New entry</h2>
        <p className="task-event-chooser__lead">Choose task or event before filling in details.</p>
      </header>
      <div className="task-event-chooser__grid">
        <button type="button" className="task-event-chooser__card" onClick={() => onSelect("task")}>
          <span className="task-event-chooser__card-kicker">Task</span>
          <span className="task-event-chooser__card-title">Assignable work</span>
          <span className="task-event-chooser__card-desc">
            Drafting, follow-ups, filings prep, calls, and field work with a due date.
          </span>
        </button>
        <button type="button" className="task-event-chooser__card" onClick={() => onSelect("event")}>
          <span className="task-event-chooser__card-kicker">Event</span>
          <span className="task-event-chooser__card-title">Calendar item</span>
          <span className="task-event-chooser__card-desc">
            Hearings, meetings, consultations, and court filing deadlines.
          </span>
        </button>
      </div>
    </section>
  );
}
