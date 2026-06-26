/** Client's role in the matter — Master List column AA. */
export const CLIENT_CASE_ROLES = [
  "Petitioner",
  "Respondent",
  "Plaintiff",
  "Defendant",
  "Accused",
  "Private Complainant"
] as const;

export type ClientCaseRole = (typeof CLIENT_CASE_ROLES)[number];

export function normalizeClientCaseRole(value: string | undefined | null): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const match = CLIENT_CASE_ROLES.find((role) => role.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}
