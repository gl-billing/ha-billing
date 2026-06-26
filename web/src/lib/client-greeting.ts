/** Salutation name for client emails — Preferred Greeting column, else first name, else "Client". */

export function resolveClientGreeting(preferredGreeting?: string, clientName?: string): string {
  const preferred = String(preferredGreeting || "").trim();
  if (preferred) return preferred;

  const name = String(clientName || "Client").trim();
  const first = name.split(/\s+/).filter(Boolean)[0];
  return first || "Client";
}

export function formatClientSalutation(preferredGreeting?: string, clientName?: string): string {
  return `Dear Sir/Ma'am ${resolveClientGreeting(preferredGreeting, clientName)}`;
}

export function formatClientSalutationHtml(
  preferredGreeting: string | undefined,
  clientName: string | undefined,
  escapeHtml: (value: string) => string
): string {
  return `<p>${escapeHtml(formatClientSalutation(preferredGreeting, clientName))},</p>`;
}
