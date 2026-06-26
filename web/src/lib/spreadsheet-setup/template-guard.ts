/** Spreadsheet IDs that must never be used as copy sources. */
export function getProtectedSpreadsheetIds(): string[] {
  return [process.env.GOOGLE_SPREADSHEET_ID, process.env.TASKS_GOOGLE_SPREADSHEET_ID]
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));
}

export function assertSafeSpreadsheetTemplate(templateId: string, label: string): void {
  const normalized = templateId.trim();
  if (!normalized) {
    throw new Error(`${label} is not configured.`);
  }

  if (getProtectedSpreadsheetIds().includes(normalized)) {
    throw new Error(
      `${label} must be a dedicated blank template — it cannot be your live HA billing or tasks workbook.`
    );
  }
}
