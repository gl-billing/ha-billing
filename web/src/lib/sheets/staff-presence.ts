import { GL } from "@/lib/gl-config";
import { appendSheetValues, updateSheetValues } from "@/lib/sheets/client";
import {
  invalidateSettingsCache,
  readSettingsMap,
  readSettingsRowIndex
} from "@/lib/sheets/settings";
import {
  collectPresenceFromSettings,
  presenceSettingKey,
  serializePresenceEntry,
  type PresenceWorkspace,
  type StaffPresenceEntry
} from "@/lib/staff-presence";

export async function listStaffPresence(accessToken: string): Promise<StaffPresenceEntry[]> {
  const settings = await readSettingsMap(accessToken);
  return collectPresenceFromSettings(settings);
}

export async function upsertStaffPresenceHeartbeat(
  accessToken: string,
  input: {
    email: string;
    displayName: string;
    workspace: PresenceWorkspace;
    path: string;
  }
): Promise<StaffPresenceEntry> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required for presence.");

  const entry: StaffPresenceEntry = {
    email,
    displayName: input.displayName.trim() || email,
    workspace: input.workspace,
    path: input.path.trim() || "/",
    lastSeen: new Date().toISOString()
  };

  const key = presenceSettingKey(email);
  const value = serializePresenceEntry(entry);
  const rowIndex = await readSettingsRowIndex(accessToken);
  const sheet = GL.sheets.settings;
  const row = rowIndex.get(key);

  if (row) {
    await updateSheetValues(accessToken, `'${sheet}'!B${row}`, [[value]]);
  } else {
    await appendSheetValues(accessToken, `'${sheet}'!A:B`, [[key, value]]);
  }

  invalidateSettingsCache(accessToken);
  return entry;
}
