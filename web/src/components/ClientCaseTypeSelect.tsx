"use client";

import {
  CLIENT_CASE_TYPE_LABELS,
  CLIENT_CASE_TYPE_OPTIONS,
  caseTypeOtherRequired,
  normalizeClientCaseType,
  type ClientCaseType
} from "@/lib/client-case-type";

type Props = {
  caseType: ClientCaseType | "";
  caseTypeOther: string;
  disabled?: boolean;
  onCaseTypeChange: (value: ClientCaseType | "") => void;
  onCaseTypeOtherChange: (value: string) => void;
};

export function ClientCaseTypeSelect({
  caseType,
  caseTypeOther,
  disabled = false,
  onCaseTypeChange,
  onCaseTypeOtherChange
}: Props) {
  return (
    <div className="space-y-2">
      <select
        className="field"
        value={caseType}
        disabled={disabled}
        onChange={(e) => {
          const next = normalizeClientCaseType(e.target.value);
          onCaseTypeChange(next);
          if (next !== "other") onCaseTypeOtherChange("");
        }}
      >
        <option value="">— Select case type —</option>
        {CLIENT_CASE_TYPE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {CLIENT_CASE_TYPE_LABELS[option]}
          </option>
        ))}
      </select>
      {caseTypeOtherRequired(caseType) ? (
        <input
          className="field"
          value={caseTypeOther}
          disabled={disabled}
          placeholder="Specify case type"
          onChange={(e) => onCaseTypeOtherChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}
