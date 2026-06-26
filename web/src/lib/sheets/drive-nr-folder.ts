import { getSpreadsheetId } from "@/lib/sheets/client";
import { readSettingsMap } from "@/lib/sheets/settings";

const NR_FOLDER_NAMES = ["Notarial Receipts", "NR", "HA Billing NR"];
const DEFAULT_NR_FOLDER_NAME = "Notarial Receipts";

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

async function findNamedNrFolder(accessToken: string): Promise<string | null> {
  for (const name of NR_FOLDER_NAMES) {
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

async function findOrCreateNrFolderBesideSpreadsheet(accessToken: string): Promise<string | null> {
  const spreadsheetId = getSpreadsheetId();
  const metaRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents&supportsAllDrives=true`
  );
  if (!metaRes.ok) {
    const detail = (await metaRes.text()).slice(0, 240);
    const hint = drivePermissionHint(metaRes.status, detail);
    throw new Error(
      hint
        ? `Could not access the billing spreadsheet in Google Drive. ${hint}`
        : `Could not read the billing spreadsheet in Google Drive (${metaRes.status}). Add NR Folder ID in the spreadsheet Settings tab, or set GOOGLE_NR_DRIVE_FOLDER_ID in Vercel.`
    );
  }

  const meta = (await metaRes.json()) as { parents?: string[] };
  const parentId = meta.parents?.[0];
  if (!parentId) return null;

  for (const name of NR_FOLDER_NAMES) {
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
        name: DEFAULT_NR_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      })
    }
  );
  if (!createRes.ok) {
    const detail = (await createRes.text()).slice(0, 200);
    const hint = drivePermissionHint(createRes.status, detail);
    throw new Error(
      hint
        ? `Could not create the notarial receipts folder in Drive. ${hint}`
        : "Could not create the notarial receipts folder in Google Drive. Add NR Folder ID in Settings with your folder ID."
    );
  }
  const created = (await createRes.json()) as { id?: string };
  return created.id || null;
}

/** Resolve the Drive folder where notarial receipt (NR) PDFs are stored — flat, not monthly. */
export async function getOrCreateNrFolderId(accessToken: string): Promise<string> {
  const settings = await readSettingsMap(accessToken);
  const configured = extractDriveId(
    settings.get("NR Folder ID")?.trim() ||
      settings.get("Notarial Receipt Folder ID")?.trim() ||
      process.env.GOOGLE_NR_DRIVE_FOLDER_ID?.trim() ||
      ""
  );
  if (configured) return configured;

  const globalFolder = await findNamedNrFolder(accessToken);
  if (globalFolder) return globalFolder;

  const besideSpreadsheet = await findOrCreateNrFolderBesideSpreadsheet(accessToken);
  if (besideSpreadsheet) return besideSpreadsheet;

  throw new Error(
    "Could not find a notarial receipts folder in Google Drive. Create a folder (e.g. Notarial Receipts), copy its folder ID from the URL, and add a row in Settings: key NR Folder ID, value the folder ID. Then retry Issue receipt."
  );
}
