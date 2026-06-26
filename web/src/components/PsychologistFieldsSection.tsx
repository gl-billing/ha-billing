"use client";

import type { ReactNode } from "react";
import { showPsychologistFields } from "@/lib/client-case-type";

type Props = {
  caseType?: string;
  caseTitle?: string;
  name: string;
  phone: string;
  address: string;
  disabled?: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">{label}</label>
      {hint ? <p className="mb-1.5 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export function PsychologistFieldsSection({
  caseType = "",
  caseTitle = "",
  name,
  phone,
  address,
  disabled = false,
  onNameChange,
  onPhoneChange,
  onAddressChange
}: Props) {
  if (!showPsychologistFields({ caseType, caseTitle })) return null;

  return (
    <div className="matter-intake-wizard__panel mt-3 space-y-0">
      <p className="matter-intake-wizard__panel-title">Psychologist</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted">
        For annulment matters — record the psychologist&apos;s details for the case file.
      </p>
      <Field label="Psychologist name">
        <input
          className="field"
          value={name}
          disabled={disabled}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Full name"
        />
      </Field>
      <Field label="Contact number">
        <input
          className="field"
          value={phone}
          disabled={disabled}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Mobile or landline"
        />
      </Field>
      <Field label="Address">
        <textarea
          className="field min-h-[72px]"
          value={address}
          disabled={disabled}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Clinic or office address"
        />
      </Field>
    </div>
  );
}
