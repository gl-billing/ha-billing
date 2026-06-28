import {
  invalidateSettingsCache,
  readSettingsMap,
  readSettingsRowIndex
} from "@/lib/sheets/settings";
import { appendSheetValues, updateSheetValues } from "@/lib/sheets/client";
import { GL } from "@/lib/gl-config";

export const LAST_PDF_BACKUP_AT_KEY = "Last PDF Backup At";

export function parseBackupTimestamp(value: string | undefined | null): number {
  const trimmed = String(value || "").trim();
  if (!trimmed) return 0;
  const ms = new Date(trimmed).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export async function getLastPdfBackupAt(accessToken: string): Promise<string | null> {
  const settings = await readSettingsMap(accessToken);
  const value = settings.get(LAST_PDF_BACKUP_AT_KEY)?.trim();
  return value || null;
}

export async function setLastPdfBackupAt(accessToken: string, isoTimestamp: string): Promise<void> {
  const rowIndex = await readSettingsRowIndex(accessToken);
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(LAST_PDF_BACKUP_AT_KEY);
  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[isoTimestamp]]);
  } else {
    await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[LAST_PDF_BACKUP_AT_KEY, isoTimestamp]]);
  }
  invalidateSettingsCache(accessToken);
}
