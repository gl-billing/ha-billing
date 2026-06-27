import { getSpreadsheetId } from "@/lib/sheets/client";
import { readSettingsMap } from "@/lib/sheets/settings";

const SOA_FOLDER_NAMES = ["SOA", "HA Billing SOA", "Statements of Account"];

const DRIVE_LIST_OPTS = "supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives";

function extractDriveId(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  return trimmed;
}

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
}

function drivePermissionHint(status: number, detail: string): string | null {
  if (status !== 403) return null;
  if (/insufficient|scope|permission|auth/i.test(detail)) {
    return "Sign out of HA Billing and sign in again so Google can grant Drive access, then retry.";
  }
  return null;
}

async function findNamedSoaFolder(accessToken: string): Promise<string | null> {
  for (const name of SOA_FOLDER_NAMES) {
    const escaped = name.replace(/'/g, "\\'");
    const query = encodeURIComponent(
      `trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escaped}'`
    );
    const res = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=3&fields=files(id,name)&${DRIVE_LIST_OPTS}`
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { files?: Array<{ id?: string }> };
    if (data.files?.[0]?.id) return data.files[0].id;
  }
  return null;
}

async function findSoaFolderBesideSpreadsheet(accessToken: string): Promise<string | null> {
  const spreadsheetId = getSpreadsheetId();
  const metaRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents&supportsAllDrives=true`
  );
  if (!metaRes.ok) return null;

  const meta = (await metaRes.json()) as { parents?: string[] };
  const parentId = meta.parents?.[0];
  if (!parentId) return null;

  for (const name of SOA_FOLDER_NAMES) {
    const escaped = name.replace(/'/g, "\\'");
    const query = encodeURIComponent(
      `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escaped}'`
    );
    const listRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1&fields=files(id,name)&${DRIVE_LIST_OPTS}`
    );
    if (!listRes.ok) continue;
    const list = (await listRes.json()) as { files?: Array<{ id?: string }> };
    if (list.files?.[0]?.id) return list.files[0].id;
  }

  const createRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "SOA",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      })
    }
  );
  if (!createRes.ok) return null;
  const created = (await createRes.json()) as { id?: string };
  return created.id || null;
}

/** Resolve the Drive folder where SOA PDFs are stored. */
export async function getOrCreateSoaFolderId(accessToken: string): Promise<string> {
  const settings = await readSettingsMap(accessToken);
  const configured = extractDriveId(
    settings.get("SOA Folder ID")?.trim() ||
      settings.get("SOA Drive Folder ID")?.trim() ||
      process.env.GOOGLE_SOA_DRIVE_FOLDER_ID?.trim() ||
      ""
  );
  if (configured) return configured;

  const globalFolder = await findNamedSoaFolder(accessToken);
  if (globalFolder) return globalFolder;

  const besideSpreadsheet = await findSoaFolderBesideSpreadsheet(accessToken);
  if (besideSpreadsheet) return besideSpreadsheet;

  throw new Error(
    "Could not find an SOA folder in Google Drive. Add SOA Folder ID in the spreadsheet Settings tab, or set GOOGLE_SOA_DRIVE_FOLDER_ID."
  );
}
