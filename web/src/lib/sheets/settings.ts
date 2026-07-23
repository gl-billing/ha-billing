import { GL } from "@/lib/gl-config";
import { appendSheetValues, getSheetValues, updateSheetValues } from "@/lib/sheets/client";
import { invalidateCache, withCache } from "@/lib/sheets/cache";
import { todayYmd } from "@/lib/office-tasks/date-only";

const SETTINGS_ROWS_CACHE_KEY = "settings-rows";
const SETTINGS_TTL_MS = 5 * 60_000;

export function invalidateSettingsCache(accessToken: string): void {
  invalidateCache(accessToken, SETTINGS_ROWS_CACHE_KEY);
}

async function loadSettingsRows(accessToken: string): Promise<string[][]> {
  return withCache(accessToken, SETTINGS_ROWS_CACHE_KEY, SETTINGS_TTL_MS, () =>
    getSheetValues(accessToken, `'${GL.sheets.settings}'!A:B`)
  );
}

export const ANNOUNCEMENT_KEYS = {
  message: "Office Announcement",
  from: "Office Announcement From",
  until: "Office Announcement Until"
} as const;

export type OfficeAnnouncementDraft = {
  message: string;
  from: string;
  until: string;
};

export type OfficeAnnouncementState = {
  draft: OfficeAnnouncementDraft;
  active: string | null;
};

function normalizeYmd(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function readAnnouncementDraft(settings: Map<string, string>): OfficeAnnouncementDraft {
  return {
    message: settings.get(ANNOUNCEMENT_KEYS.message) ?? "",
    from: settings.get(ANNOUNCEMENT_KEYS.from) ?? "",
    until: settings.get(ANNOUNCEMENT_KEYS.until) ?? ""
  };
}

/** Active notice from Settings sheet keys, respecting optional from/until dates (YYYY-MM-DD). */
export function activeAnnouncementFromSettings(
  settings: Map<string, string>,
  today = todayYmd()
): string | null {
  const message = settings.get(ANNOUNCEMENT_KEYS.message)?.trim();
  if (!message) return null;

  const from = settings.get(ANNOUNCEMENT_KEYS.from);
  if (from) {
    const fromYmd = normalizeYmd(from);
    if (fromYmd && today < fromYmd) return null;
  }

  const until = settings.get(ANNOUNCEMENT_KEYS.until);
  if (until) {
    const untilYmd = normalizeYmd(until);
    if (untilYmd && today > untilYmd) return null;
  }

  return message;
}

export async function readSettingsMap(accessToken: string): Promise<Map<string, string>> {
  const rows = await loadSettingsRows(accessToken);
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = String(row[0] ?? "").trim();
    if (!key) continue;
    map.set(key, String(row[1] ?? "").trim());
  }
  return map;
}

export async function readSettingsRowIndex(accessToken: string): Promise<Map<string, number>> {
  const rows = await loadSettingsRows(accessToken);
  return buildRowIndex(rows);
}

export async function getOfficeAnnouncementState(accessToken: string): Promise<OfficeAnnouncementState> {
  const settings = await readSettingsMap(accessToken);
  return {
    draft: readAnnouncementDraft(settings),
    active: activeAnnouncementFromSettings(settings)
  };
}

function buildRowIndex(rows: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = String(row[0] ?? "").trim();
    if (key) map.set(key, index + 1);
  });
  return map;
}

async function upsertSettingValue(
  accessToken: string,
  key: string,
  value: string,
  rowIndex: Map<string, number>
): Promise<void> {
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(key);
  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[value]]);
    return;
  }
  await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[key, value]]);
  rowIndex.set(key, Math.max(0, ...rowIndex.values()) + 1);
}

/** Write one Settings-tab key/value in the current spreadsheet. */
export async function upsertSetting(
  accessToken: string,
  key: string,
  value: string
): Promise<void> {
  const rowIndex = await readSettingsRowIndex(accessToken);
  await upsertSettingValue(accessToken, key, value, rowIndex);
  invalidateSettingsCache(accessToken);
}

/** Write several Settings-tab keys in the current spreadsheet. */
export async function upsertSettings(
  accessToken: string,
  entries: Array<[string, string]>
): Promise<void> {
  const rowIndex = await readSettingsRowIndex(accessToken);
  for (const [key, value] of entries) {
    await upsertSettingValue(accessToken, key, value, rowIndex);
  }
  invalidateSettingsCache(accessToken);
}

export function normalizeAnnouncementDraft(input: {
  message?: string;
  from?: string;
  until?: string;
}): OfficeAnnouncementDraft {
  const message = String(input.message ?? "").trim();
  const fromRaw = String(input.from ?? "").trim();
  const untilRaw = String(input.until ?? "").trim();

  if (fromRaw && !normalizeYmd(fromRaw)) {
    throw new Error("Show from must be YYYY-MM-DD.");
  }
  if (untilRaw && !normalizeYmd(untilRaw)) {
    throw new Error("Show until must be YYYY-MM-DD.");
  }
  if (fromRaw && untilRaw) {
    const fromYmd = normalizeYmd(fromRaw)!;
    const untilYmd = normalizeYmd(untilRaw)!;
    if (fromYmd > untilYmd) {
      throw new Error("Show from cannot be after show until.");
    }
  }
  if (message.length > 280) {
    throw new Error("Announcement must be 280 characters or less.");
  }

  return {
    message,
    from: fromRaw ? normalizeYmd(fromRaw)! : "",
    until: untilRaw ? normalizeYmd(untilRaw)! : ""
  };
}

export async function saveOfficeAnnouncement(
  accessToken: string,
  draft: OfficeAnnouncementDraft
): Promise<OfficeAnnouncementState> {
  const rowIndex = await readSettingsRowIndex(accessToken);

  await upsertSettingValue(accessToken, ANNOUNCEMENT_KEYS.message, draft.message, rowIndex);
  await upsertSettingValue(accessToken, ANNOUNCEMENT_KEYS.from, draft.from, rowIndex);
  await upsertSettingValue(accessToken, ANNOUNCEMENT_KEYS.until, draft.until, rowIndex);

  invalidateSettingsCache(accessToken);
  const settings = await readSettingsMap(accessToken);
  return {
    draft: readAnnouncementDraft(settings),
    active: activeAnnouncementFromSettings(settings)
  };
}
