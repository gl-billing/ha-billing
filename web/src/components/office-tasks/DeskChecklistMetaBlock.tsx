import type { DeskChecklistMetaDisplay } from "@/lib/office-tasks/desk-checklist";

type Props = {
  display: DeskChecklistMetaDisplay;
  muted?: boolean;
  size?: "row" | "dialog";
  layout?: "stack" | "aside" | "dialog";
  extraChips?: string[];
  className?: string;
};

export function DeskChecklistMetaBlock({
  display,
  muted = false,
  size = "row",
  layout = "stack",
  extraChips = [],
  className = ""
}: Props) {
  const chipCount = display.chips.length + extraChips.length;
  const visibleChips =
    layout === "dialog" ? display.chips.filter((chip) => chip.key !== "kind") : display.chips;
  const visibleChipCount = visibleChips.length + extraChips.length;
  if (!visibleChipCount && !display.lines.length) return null;

  const rootClass = [
    "desk-checklist-meta",
    `desk-checklist-meta--${size}`,
    layout === "aside" ? "desk-checklist-meta--aside" : "",
    layout === "dialog" ? "desk-checklist-meta--dialog-head" : "",
    muted ? "desk-checklist-meta--muted" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {visibleChipCount ? (
        <div className="desk-checklist-meta__chips">
          {visibleChips.map((chip) => (
            <span
              key={chip.key}
              className={`desk-checklist-meta__chip desk-checklist-meta__chip--${chip.tone || "kind"}`}
            >
              {chip.label}
            </span>
          ))}
          {extraChips.map((label) => (
            <span key={label} className="desk-checklist-meta__chip desk-checklist-meta__chip--extra">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {display.lines.length ? (
        <dl className="desk-checklist-meta__lines">
          {display.lines.map((line) => (
            <div key={line.key} className="desk-checklist-meta__line">
              <dt className="desk-checklist-meta__label">{line.label}</dt>
              <dd
                className={`desk-checklist-meta__value${
                  line.tone === "overdue" ? " desk-checklist-meta__value--overdue" : ""
                }`}
                title={line.value}
              >
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
