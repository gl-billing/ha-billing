/**
 * Templates library — Drive root + category folders.
 * Root folder: "Templates — HA Office" beside the billing spreadsheet.
 */

import { getSpreadsheetId } from "@/lib/sheets/client";
import { readSettingsMap, upsertSettings } from "@/lib/sheets/settings";
import {
  MAX_TEMPLATE_UPLOAD_BYTES,
  TEMPLATE_FOLDERS,
  isAllowedTemplateMime,
  isTemplateFolderId,
  templateFolderById,
  type TemplateFileSummary,
  type TemplateFolderId
} from "@/lib/firm-templates";

const TEMPLATES_FOLDER_ID_KEY = "Templates Folder ID";
const TEMPLATES_FOLDER_LINK_KEY = "Templates Folder Link";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type SandboxFile = TemplateFileSummary & { folderId: TemplateFolderId };

const sandboxFiles = new Map<string, SandboxFile>();

function templatesRootName(): string {
  return "Templates — HA Office".slice(0, 120);
}

function sanitizeFileName(value: string): string {
  return (
    String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 180) || "template"
  );
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

async function findChildDriveFolder(
  accessToken: string,
  parentFolderId: string,
  name: string
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `'${parentFolderId}' in parents and trashed=false and mimeType='${FOLDER_MIME}' and name='${escaped}'`
  );
  const response = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { files?: Array<{ id?: string }> };
  return payload.files?.[0]?.id ?? null;
}

async function ensureDriveFolder(
  accessToken: string,
  name: string,
  parentFolderId?: string
): Promise<string> {
  if (parentFolderId) {
    const existing = await findChildDriveFolder(accessToken, parentFolderId, name);
    if (existing) return existing;
  }

  const response = await driveFetch(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        ...(parentFolderId ? { parents: [parentFolderId] } : {})
      })
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`Could not create the "${name}" folder in Google Drive (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error(`Created the "${name}" folder but no Drive id was returned.`);
  }
  return payload.id;
}

async function getDriveFileParentFolderId(
  accessToken: string,
  fileId: string
): Promise<string | null> {
  const response = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=parents`
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { parents?: string[] };
  return payload.parents?.[0] ?? null;
}

async function uploadDriveFile(
  accessToken: string,
  options: {
    name: string;
    mimeType: string;
    bytes: Buffer;
    parentFolderId?: string;
  }
): Promise<string> {
  const boundary = `ha-tpl-${Date.now()}`;
  const metadata = JSON.stringify({
    name: options.name,
    mimeType: options.mimeType,
    ...(options.parentFolderId ? { parents: [options.parentFolderId] } : {})
  });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${options.mimeType}\r\n\r\n`
    ),
    options.bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const response = await driveFetch(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`Could not upload template (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Upload succeeded but no Drive file id was returned.");
  }
  return payload.id;
}

async function ensureTemplatesRoot(accessToken: string): Promise<{ id: string; link: string }> {
  const settings = await readSettingsMap(accessToken);
  const existingId = settings.get(TEMPLATES_FOLDER_ID_KEY)?.trim() || "";
  if (existingId) {
    const link =
      settings.get(TEMPLATES_FOLDER_LINK_KEY)?.trim() ||
      `https://drive.google.com/drive/folders/${existingId}`;
    return { id: existingId, link };
  }

  const spreadsheetId = getSpreadsheetId();
  const parentFolderId = await getDriveFileParentFolderId(accessToken, spreadsheetId);
  const id = await ensureDriveFolder(accessToken, templatesRootName(), parentFolderId || undefined);
  const link = `https://drive.google.com/drive/folders/${id}`;
  await upsertSettings(accessToken, [
    [TEMPLATES_FOLDER_ID_KEY, id],
    [TEMPLATES_FOLDER_LINK_KEY, link]
  ]);
  return { id, link };
}

async function ensureCategoryFolder(
  accessToken: string,
  rootId: string,
  folderId: TemplateFolderId
): Promise<string> {
  const def = templateFolderById(folderId);
  return ensureDriveFolder(accessToken, def.driveName, rootId);
}

async function listDriveFilesInFolder(
  accessToken: string,
  folderId: string
): Promise<TemplateFileSummary[]> {
  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`
  );
  const response = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=200&orderBy=name&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`Could not list template files (${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      webViewLink?: string;
      modifiedTime?: string;
      size?: string;
    }>;
  };
  return (payload.files || [])
    .filter((file) => file.id && file.name)
    .map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType || "application/octet-stream",
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      modifiedTime: file.modifiedTime,
      size: file.size ? Number(file.size) : undefined
    }));
}

export function listSandboxTemplateFiles(folderId: TemplateFolderId): TemplateFileSummary[] {
  return [...sandboxFiles.values()]
    .filter((file) => file.folderId === folderId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ folderId: _folderId, ...file }) => file);
}

export function uploadSandboxTemplateFile(input: {
  folderId: TemplateFolderId;
  name: string;
  mimeType: string;
  size: number;
}): TemplateFileSummary {
  const id = `sandbox-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const file: SandboxFile = {
    id,
    folderId: input.folderId,
    name: sanitizeFileName(input.name),
    mimeType: input.mimeType || "application/octet-stream",
    webViewLink: `#sandbox-template/${id}`,
    modifiedTime: new Date().toISOString(),
    size: input.size
  };
  sandboxFiles.set(id, file);
  const { folderId: _folderId, ...summary } = file;
  return summary;
}

export async function listFirmTemplateFiles(
  accessToken: string,
  folderId: TemplateFolderId
): Promise<{ files: TemplateFileSummary[]; rootLink: string; folderLabel: string }> {
  const root = await ensureTemplatesRoot(accessToken);
  await Promise.all(
    TEMPLATE_FOLDERS.map((folder) => ensureCategoryFolder(accessToken, root.id, folder.id))
  );
  const categoryId = await ensureCategoryFolder(accessToken, root.id, folderId);
  const files = await listDriveFilesInFolder(accessToken, categoryId);
  return {
    files,
    rootLink: root.link,
    folderLabel: templateFolderById(folderId).label
  };
}

export async function uploadFirmTemplateFile(
  accessToken: string,
  input: {
    folderId: TemplateFolderId;
    name: string;
    mimeType: string;
    bytes: Buffer;
  }
): Promise<TemplateFileSummary> {
  if (!isTemplateFolderId(input.folderId)) {
    throw new Error("Choose a valid templates folder.");
  }
  if (!isAllowedTemplateMime(input.mimeType, input.name)) {
    throw new Error("Upload a PDF, Word (.doc/.docx), or RTF file.");
  }
  if (input.bytes.length <= 0) {
    throw new Error("Choose a file before uploading.");
  }
  if (input.bytes.length > MAX_TEMPLATE_UPLOAD_BYTES) {
    throw new Error("File is too large (max 10 MB).");
  }

  const root = await ensureTemplatesRoot(accessToken);
  const categoryId = await ensureCategoryFolder(accessToken, root.id, input.folderId);
  const safeName = sanitizeFileName(input.name);
  const fileId = await uploadDriveFile(accessToken, {
    name: safeName,
    mimeType: input.mimeType || "application/octet-stream",
    bytes: input.bytes,
    parentFolderId: categoryId
  });

  return {
    id: fileId,
    name: safeName,
    mimeType: input.mimeType || "application/octet-stream",
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    modifiedTime: new Date().toISOString(),
    size: input.bytes.length
  };
}
