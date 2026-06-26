"use client";

import { CLIENT_CASE_ROLES } from "@/lib/client-case-role";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  id?: string;
};

export function ClientCaseRoleSelect({
  value,
  onChange,
  disabled,
  className = "field",
  allowEmpty = true,
  id
}: Props) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">— Select role —</option> : null}
      {CLIENT_CASE_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}
