"use client";

import {
  CLIENT_MATTER_TYPE_HINTS,
  CLIENT_MATTER_TYPE_LABELS,
  type ClientMatterType
} from "@/lib/client-matter-type";

type Props = {
  value: ClientMatterType;
  disabled?: boolean;
  onChange: (value: ClientMatterType) => void;
};

const OPTIONS: ClientMatterType[] = ["case", "retainer", "general"];

export function ClientMatterTypeSelect({ value, disabled = false, onChange }: Props) {
  return (
    <div className="space-y-1">
      <select
        className="field"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ClientMatterType)}
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {CLIENT_MATTER_TYPE_LABELS[option]}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-relaxed text-muted">{CLIENT_MATTER_TYPE_HINTS[value]}</p>
    </div>
  );
}
