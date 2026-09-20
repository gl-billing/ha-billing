/**
 * Shared Drive upload + Document Log for firm PDFs emailed from HA.
 * Category folders mirror existing SOA / AR / NR resolution patterns.
 */

import { getSpreadsheetId } from "@/lib/sheets/client";
import { appendDocumentLogEntry } from "@/lib/sheets/document-log";
import { readSettingsMap, upsertSetting } from "@/lib/sheets/settings";

/** Document Log `documentType` values — Drive tab / history filters use these. */
export type FirmPdfDocumentType =
  | "SOA"
  | "AR"
  | "NR"
  | "Correspondence"
  | "Engagement"
  | "Contract"
  | "Spot Charge"
  | "Spot Receipt"
  | "Status Report"
  | "Payslip";

export type DrivePdfCategory =
  | "soa"
  | "ar"
  | "nr"
  | "correspondence"
  | "engagement"
  | "spot"
  | "status-report"
  | "payslip";

const CATEGORY_CONFIG: Record<
  DrivePdfCategory,
  {
    folderNames: string[];
    defaultFolderName: string;
    settingsKeys: string[];
    envKeys: string[];
    label: string;
  }
> = {
  soa: {
    folderNames: ["SOA", "HA Billing SOA", "Statements of Account"],
    defaultFolderName: "SOA",
    settingsKeys: ["SOA Folder ID", "SOA Drive Folder ID"],
    envKeys: ["GOOGLE_SOA_DRIVE_FOLDER_ID"],
    label: "SOA"
  },
  ar: {
    folderNames: ["AR", "HA Billing AR", "Acknowledgment Receipts"],
    defaultFolderName: "AR",
    settingsKeys: ["AR Folder ID", "AR Drive Folder ID"],
    envKeys: ["GOOGLE_AR_DRIVE_FOLDER_ID"],
    label: "AR"
  },
  nr: {
    folderNames: ["Notarial Receipts", "NR", "HA Billing NR"],
    defaultFolderName: "Notarial Receipts",
    settingsKeys: ["NR Folder ID", "Notarial Receipt Folder ID"],
    envKeys: ["GOOGLE_NR_DRIVE_FOLDER_ID"],
    label: "notarial receipt"
  },
  correspondence: {
    folderNames: ["Correspondence", "HA Correspondence", "Letters"],
    defaultFolderName: "Correspondence",
    settingsKeys: [
      "Correspondence Folder ID",
      "Client Documents Drive Folder",
      "Drive Folder Link"
    ],
    envKeys: ["GOOGLE_CORRESPONDENCE_DRIVE_FOLDER_ID", "GOOGLE_CLIENT_DOCUMENTS_DRIVE_FOLDER_ID"],
    label: "correspondence"
  },
  engagement: {
    folderNames: ["Engagement Letters", "Contracts", "HA Engagement"],
    defaultFolderName: "Engagement Letters",
    settingsKeys: [
      "Engagement Folder ID",
      "Client Documents Drive Folder",
      "Drive Folder Link"
    ],
    envKeys: ["GOOGLE_ENGAGEMENT_DRIVE_FOLDER_ID", "GOOGLE_CLIENT_DOCUMENTS_DRIVE_FOLDER_ID"],
    label: "engagement letter"
  },
  spot: {
    folderNames: ["Spot Billing", "HA Spot Billing", "One-time Fees"],
    defaultFolderName: "Spot Billing",
    settingsKeys: ["Spot Billing Folder ID", "Client Documents Drive Folder", "Drive Folder Link"],
    envKeys: ["GOOGLE_SPOT_DRIVE_FOLDER_ID", "GOOGLE_CLIENT_DOCUMENTS_DRIVE_FOLDER_ID"],
    label: "spot billing letter"
  },
  "status-report": {
    folderNames: ["Status Reports", "HA Status Reports"],
    defaultFolderName: "Status Reports",
    settingsKeys: ["Status Report Folder ID", "Client Documents Drive Folder"],
    envKeys: ["GOOGLE_STATUS_REPORT_DRIVE_FOLDER_ID", "GOOGLE_CLIENT_DOCUMENTS_DRIVE_FOLDER_ID"],
    label: "status report"
  },
  payslip: {
    folderNames: ["Payslips", "HA Payslips", "Payroll"],
    defaultFolderName: "Payslips",
    settingsKeys: ["Payslip Folder ID"],
    envKeys: ["GOOGLE_PAYSLIP_DRIVE_FOLDER_ID"],
    label: "payslip"
  }
};

const DRIVE_LIST_OPTS = "supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives";

function looksLikeDriveId(value: string): boolean {
  // Reject placeholders like "not setup", "—", or short notes stored in Settings.
  return /^[a-zA-Z0-9_-]{10,}$/.test(value);
}

function extractDriveId(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1] && looksLikeDriveId(folderMatch[1])) return folderMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1] && looksLikeDriveId(fileMatch[1])) return fileMatch[1];
  return looksLikeDriveId(trimmed) ? trimmed : "";
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

async function findNamedFolder(accessToken: string, names: string[]): Promise<string | null> {
  for (const name of names) {
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

async function isUsableDriveFolder(accessToken: string, folderId: string): Promise<boolean> {
  const res = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed&supportsAllDrives=true`
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { mimeType?: string; trashed?: boolean };
  return data.mimeType === "application/vnd.google-apps.folder" && !data.trashed;
}

async function createDriveFolder(
  accessToken: string,
  name: string,
  label: string,
  parentId?: string
): Promise<string> {
  const createRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {})
      })
    }
  );
  if (!createRes.ok) {
    const detail = (await createRes.text()).slice(0, 200);
    const hint = drivePermissionHint(createRes.status, detail);
    throw new Error(
      hint
        ? `Could not create the ${label} folder in Drive. ${hint}`
        : `Could not create the ${label} folder in Google Drive (${createRes.status}). Sign in again with Drive access, then retry.`
    );
  }
  const created = (await createRes.json()) as { id?: string };
  if (!created.id) {
    throw new Error(`Created the ${label} folder but Google Drive returned no folder ID.`);
  }
  return created.id;
}

async function findOrCreateBesideSpreadsheet(
  accessToken: string,
  names: string[],
  defaultName: string,
  label: string
): Promise<string | null> {
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
        : `Could not read the billing spreadsheet in Google Drive (${metaRes.status}).`
    );
  }

  const meta = (await metaRes.json()) as { parents?: string[] };
  const parentId = meta.parents?.[0];
  if (!parentId) return null;

  for (const name of names) {
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

  return createDriveFolder(accessToken, defaultName, label, parentId);
}

async function rememberDriveFolderId(
  accessToken: string,
  settingsKey: string,
  folderId: string
): Promise<void> {
  try {
    await upsertSetting(accessToken, settingsKey, folderId);
  } catch {
    // Folder still works for this send even if Settings write fails.
  }
}

/** Resolve (or create) the Drive folder for a document category. */
export async function getOrCreateDriveCategoryFolderId(
  accessToken: string,
  category: DrivePdfCategory
): Promise<string> {
  const config = CATEGORY_CONFIG[category];
  const settings = await readSettingsMap(accessToken);
  const settingsKey = config.settingsKeys[0];

  for (const key of config.settingsKeys) {
    const configured = extractDriveId(settings.get(key)?.trim() || "");
    if (configured && (await isUsableDriveFolder(accessToken, configured))) {
      return configured;
    }
  }
  for (const envKey of config.envKeys) {
    const configured = extractDriveId(process.env[envKey]?.trim() || "");
    if (configured && (await isUsableDriveFolder(accessToken, configured))) {
      return configured;
    }
  }

  const globalFolder = await findNamedFolder(accessToken, config.folderNames);
  if (globalFolder) {
    await rememberDriveFolderId(accessToken, settingsKey, globalFolder);
    return globalFolder;
  }

  const beside = await findOrCreateBesideSpreadsheet(
    accessToken,
    config.folderNames,
    config.defaultFolderName,
    config.label
  );
  if (beside) {
    await rememberDriveFolderId(accessToken, settingsKey, beside);
    return beside;
  }

  // Spreadsheet has no parent folder (e.g. My Drive root ownership edge cases) —
  // still auto-create the category folder in My Drive so SOA/AR sends are not blocked.
  const created = await createDriveFolder(accessToken, config.defaultFolderName, config.label);
  await rememberDriveFolderId(accessToken, settingsKey, created);
  return created;
}

/** Upload a PDF to a Drive folder; returns a web view link. */
export async function uploadPdfToDriveFolder(
  accessToken: string,
  folderId: string,
  filename: string,
  pdf: Buffer | Uint8Array,
  label = "PDF"
): Promise<string> {
  const boundary = `ha-billing-${Date.now()}`;
  const bytes = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: "application/pdf"
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const uploadRes = await driveFetch(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  if (!uploadRes.ok) {
    const detail = (await uploadRes.text()).slice(0, 200);
    if (/insufficient|scope|permission|403/i.test(detail)) {
      throw new Error(
        `Google Drive permission is required to save ${label} PDFs. Sign out and sign in again to grant Drive access, then retry.`
      );
    }
    throw new Error(`Could not save ${label} PDF to Drive (${uploadRes.status}).`);
  }

  const file = (await uploadRes.json()) as { id?: string; webViewLink?: string };
  if (file.webViewLink) return file.webViewLink;
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`;
  throw new Error(`${label} PDF was uploaded but no view link was returned.`);
}

export type SaveOutboundPdfResult = {
  pdfUrl: string | null;
  driveSaved: boolean;
  driveWarning: string | null;
};

/**
 * Upload PDF to the category Drive folder and append Document Log.
 * Does not throw on Drive/log failure — returns a warning so email can still succeed.
 */
export async function saveOutboundFirmPdf(input: {
  accessToken: string;
  category: DrivePdfCategory;
  documentType: FirmPdfDocumentType;
  filename: string;
  pdf: Buffer | Uint8Array;
  clientCode?: string;
  clientName?: string;
  documentNumber?: string;
  amount?: number;
  email?: string;
  status?: string;
  user?: string;
}): Promise<SaveOutboundPdfResult> {
  let pdfUrl: string | null = null;
  let driveWarning: string | null = null;

  try {
    const folderId = await getOrCreateDriveCategoryFolderId(input.accessToken, input.category);
    pdfUrl = await uploadPdfToDriveFolder(
      input.accessToken,
      folderId,
      input.filename,
      input.pdf,
      input.documentType
    );
  } catch (error) {
    driveWarning =
      error instanceof Error
        ? error.message
        : `Could not save ${input.documentType} PDF to Drive.`;
  }

  try {
    await appendDocumentLogEntry(input.accessToken, {
      clientCode: input.clientCode?.trim() || "—",
      clientName: input.clientName?.trim() || "",
      documentType: input.documentType,
      documentNumber: input.documentNumber?.trim() || input.filename.replace(/\.pdf$/i, ""),
      amount: input.amount ?? 0,
      email: input.email?.trim() || "",
      pdfUrl: pdfUrl || "",
      status: input.status || (pdfUrl ? "Saved" : "Drive save failed"),
      user: input.user
    });
  } catch {
    if (!driveWarning) {
      driveWarning = "PDF may be on Drive, but Document Log could not be updated.";
    }
  }

  return {
    pdfUrl,
    driveSaved: Boolean(pdfUrl),
    driveWarning
  };
}

/** Append Drive-save note to a user-facing success message. */
export function withDriveSaveMessage(base: string, result: SaveOutboundPdfResult): string {
  if (result.driveSaved) {
    return `${base} Saved to Drive (Document Log).`;
  }
  if (result.driveWarning) {
    return `${base} Drive save skipped: ${result.driveWarning}`;
  }
  return base;
}
