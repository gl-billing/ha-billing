"use client";

import { GlobalSearchBar } from "@/components/GlobalSearchBar";

type Props = {
  value: string;
  onChange: (query: string) => void;
  onSubmit: (query: string) => void;
  busy?: boolean;
  className?: string;
};

/** @deprecated Use GlobalSearchBar via FirmWorkspaceShell */
export function TasksSearchBar({ value, onChange, onSubmit, busy, className }: Props) {
  return (
    <GlobalSearchBar
      className={className}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      busy={busy}
      placeholder="Search tasks, hearings, clients, assignees…"
    />
  );
}
