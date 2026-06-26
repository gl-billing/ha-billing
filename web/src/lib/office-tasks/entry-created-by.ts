const CREATED_BY_RE = /HA_CREATED_BY:([^\n\r]+)/i;

export function entryCreatedByMarker(user: string): string {
  const label = String(user || "").trim();
  return label ? `HA_CREATED_BY:${label}` : "";
}

export function parseEntryCreatedBy(remarks: string | null | undefined): string | null {
  const match = String(remarks || "").match(CREATED_BY_RE);
  return match?.[1]?.trim() || null;
}

export function appendEntryCreatedByMarker(remarks: string, user: string): string {
  const marker = entryCreatedByMarker(user);
  if (!marker) return remarks;
  if (CREATED_BY_RE.test(remarks)) return remarks;
  const base = String(remarks || "").trim();
  return base ? `${base}\n${marker}` : marker;
}

export function resolveEntryRegistrarLabel(item: {
  remarks?: string | null;
  assignedTo?: string | null;
}): string {
  return (
    parseEntryCreatedBy(item.remarks) ||
    String(item.assignedTo || "").trim() ||
    "another staff member"
  );
}
