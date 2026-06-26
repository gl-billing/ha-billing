"use client";

export type SegmentedOption = string | { value: string; label: string };

type EventSegmentedControlProps = {
  label?: string;
  required?: boolean;
  hint?: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  otherPlaceholder?: string;
  otherInputName?: string;
  compact?: boolean;
  /** Larger dual toggle for hearings vs filings mode switch. */
  mode?: "default" | "hero";
  "aria-label"?: string;
};

function normalizeOption(option: SegmentedOption): { value: string; label: string } {
  return typeof option === "string" ? { value: option, label: option } : option;
}

function segmentLayoutClass(optionCount: number, compact?: boolean, mode?: "default" | "hero"): string {
  const parts = ["event-segmented"];
  if (mode === "hero") parts.push("event-segmented--hero");
  if (compact) {
    parts.push("event-segmented--compact");
    if (optionCount === 4) parts.push("event-segmented--cols-4");
    else if (optionCount === 3) parts.push("event-segmented--cols-3");
    else parts.push("event-segmented--cols-auto");
    return parts.join(" ");
  }
  if (optionCount === 2) parts.push("event-segmented--cols-2");
  else if (optionCount === 3) parts.push("event-segmented--cols-3");
  else if (optionCount <= 9) parts.push("event-segmented--cols-3");
  else parts.push("event-segmented--cols-auto");
  return parts.join(" ");
}

export function EventSegmentedControl({
  label,
  required,
  hint,
  options,
  value,
  onChange,
  otherValue = "",
  onOtherChange,
  otherPlaceholder = "Specify…",
  otherInputName = "categoryOther",
  compact = false,
  mode = "default",
  "aria-label": ariaLabel
}: EventSegmentedControlProps) {
  const normalized = options.map(normalizeOption);
  const showOther = value === "Other" && onOtherChange;
  const showLabel = Boolean(label?.trim()) || required;

  return (
    <div className={segmentLayoutClass(normalized.length, compact, mode)}>
      {showLabel ? (
        <span className="form-field__label">
          {label}
          {required ? <span className="form-field__required"> *</span> : null}
        </span>
      ) : null}
      {hint ? <p className="event-segmented__hint">{hint}</p> : null}
      <div className="event-segmented__track" role="group" aria-label={ariaLabel || label || "Options"}>
        {normalized.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`event-segmented__pill ${value === option.value ? "event-segmented__pill--active" : ""}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {showOther ? (
        <input
          name={otherInputName}
          className="field-input event-segmented__other"
          value={otherValue}
          required
          placeholder={otherPlaceholder}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

type EventAssigneeToggleProps = {
  name: string;
  role: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function EventAssigneeToggle({
  name,
  role,
  checked,
  onChange,
  disabled
}: EventAssigneeToggleProps) {
  return (
    <button
      type="button"
      className={`event-assignee-toggle ${checked ? "event-assignee-toggle--on" : ""}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="event-assignee-toggle__name">{name}</span>
      <span className="event-assignee-toggle__role">{role}</span>
    </button>
  );
}
