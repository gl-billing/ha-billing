"use client";

import { clientCodeFromCase, parseClientCodeFromSourceId } from "@/lib/office-tasks/client-matter";

type Props = {
  id: string;
  clientCase?: string;
  variant?: "pill" | "foot" | "mini";
  className?: string;
};

/** Task / event ID — display only (client code opens the matter panel from the card header). */
export function SourceIdDisplay({ id, clientCase, variant = "pill", className = "" }: Props) {
  const trimmed = String(id || "").trim();
  const label = clientCase?.trim() || "";
  const caseCode = label ? clientCodeFromCase(label) : null;
  const idPrefix = parseClientCodeFromSourceId(trimmed);
  const mismatched = Boolean(label && idPrefix && caseCode && idPrefix !== caseCode);

  if (!trimmed) return <span className={className}>—</span>;

  return (
    <span
      className={`source-id-display source-id-display--${variant} ${mismatched ? "source-id-display--warn" : ""} ${className}`.trim()}
      title={mismatched ? `ID prefix ${idPrefix} does not match client ${caseCode}` : trimmed}
    >
      {trimmed}
    </span>
  );
}
