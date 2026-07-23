import type { DeskChecklistStatusPill } from "@/lib/office-tasks/desk-checklist";

type Props = {
  pills: DeskChecklistStatusPill[];
  muted?: boolean;
  className?: string;
};

export function DeskChecklistStatusPills({ pills, muted = false, className = "" }: Props) {
  if (!pills.length) return null;

  return (
    <div
      className={`desk-checklist-status-pills${muted ? " desk-checklist-status-pills--muted" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={`desk-checklist-status-pill desk-checklist-status-pill--${pill.tone}`}
        >
          {pill.label}
        </span>
      ))}
    </div>
  );
}
