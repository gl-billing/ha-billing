/** Parse ledger display dates (e.g. "Jul 2, 2026") to ISO date for Postgres. */
export function parseLedgerDateToIso(display: string): string | null {
  const text = String(display ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
