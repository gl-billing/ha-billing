/** Short single-line label — full value stays in title/tooltip. */
export function truncateForDisplay(text: string, maxLength = 48): string {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

/** @deprecated Use truncateForDisplay */
export function truncateLinkForDisplay(url: string, maxLength = 48): string {
  return truncateForDisplay(url, maxLength);
}
