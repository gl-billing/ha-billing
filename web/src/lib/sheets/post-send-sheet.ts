/** Collect non-fatal bookkeeping errors after SOA/AR email already succeeded. */
export async function runPostSendSheetStep(
  label: string,
  step: () => Promise<void>,
  warnings: string[]
): Promise<void> {
  try {
    await step();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    warnings.push(`${label}: ${detail}`);
  }
}

export function withPostSendSheetWarning(baseMessage: string, warnings: string[]): string {
  if (!warnings.length) return baseMessage;
  const first = warnings[0];
  const extra =
    warnings.length > 1 ? ` (+${warnings.length - 1} more sheet update issue${warnings.length === 2 ? "" : "s"})` : "";
  return `${baseMessage} Spreadsheet follow-up incomplete — ${first}${extra}`;
}
