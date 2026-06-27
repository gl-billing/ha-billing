"use client";

import { useEffect, useMemo, useState } from "react";
import { mergeLawyerDropdownOption } from "@/lib/assigned-lawyers";

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="form-field block">
      <span className="form-field__label">{label}</span>
      {hint ? <span className="form-field__hint">{hint}</span> : null}
      {children}
    </label>
  );
}

type Props = {
  primaryLawyer: string;
  secondaryLawyer: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  disabled?: boolean;
  requirePrimary?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  layout?: "stack" | "pair";
};

export function AssignedLawyerFields({
  primaryLawyer,
  secondaryLawyer,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
  requirePrimary = false,
  primaryLabel = "Assigned lawyer",
  secondaryLabel = "Second lawyer (optional)",
  layout = "pair"
}: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/firm-lawyers/options")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setOptions(Array.isArray(json.lawyers) ? json.lawyers : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryOptions = useMemo(
    () => mergeLawyerDropdownOption(options, primaryLawyer),
    [options, primaryLawyer]
  );

  const secondaryOptions = useMemo(() => {
    const withoutPrimary = primaryOptions.filter((name) => name !== primaryLawyer.trim());
    return mergeLawyerDropdownOption(withoutPrimary, secondaryLawyer);
  }, [primaryOptions, primaryLawyer, secondaryLawyer]);

  const fields = (
    <>
      <Field
        label={`${primaryLabel}${requirePrimary ? " *" : ""}`}
        hint="From Payroll → Associate lawyers, plus the managing partner."
      >
        <select
          className="field"
          value={primaryLawyer}
          disabled={disabled || loading}
          required={requirePrimary}
          onChange={(e) => onPrimaryChange(e.target.value)}
        >
          <option value="">{loading ? "Loading lawyers…" : "Select lawyer"}</option>
          {primaryOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={secondaryLabel}
        hint="Most matters have two lawyers. Leave blank when only one counsel is assigned."
      >
        <select
          className="field"
          value={secondaryLawyer}
          disabled={disabled || loading}
          onChange={(e) => onSecondaryChange(e.target.value)}
        >
          <option value="">— None —</option>
          {secondaryOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );

  if (layout === "stack") {
    return <div className="space-y-3">{fields}</div>;
  }

  return <div className="form-grid-pair">{fields}</div>;
}
