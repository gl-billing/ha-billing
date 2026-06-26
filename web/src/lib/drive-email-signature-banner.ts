import fs from "fs";
import path from "path";
import { EMAIL_SIGNATURE_BANNER_CID } from "@/lib/firm-email-signature";

export type EmailSignatureBanner = {
  contentId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
};

const DRIVE_FILE_NAME = "email signature";

function configuredFileId(): string | null {
  const id = process.env.FIRM_EMAIL_SIGNATURE_DRIVE_FILE_ID?.trim();
  return id || null;
}

function normalizeDriveName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim().toLowerCase();
}

function isEmailSignatureFileName(name: string): boolean {
  return normalizeDriveName(name) === DRIVE_FILE_NAME;
}

async function driveFetch(accessToken: string, url: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
}

async function findDriveFileId(accessToken: string): Promise<{ id: string; name: string; mimeType: string } | null> {
  const configured = configuredFileId();
  if (configured) {
    const metaRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(configured)}?fields=id,name,mimeType`
    );
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { id?: string; name?: string; mimeType?: string };
    if (!meta.id) return null;
    return { id: meta.id, name: meta.name || DRIVE_FILE_NAME, mimeType: meta.mimeType || "image/jpeg" };
  }

  const folderId = process.env.FIRM_EMAIL_SIGNATURE_DRIVE_FOLDER_ID?.trim();
  const folderClause = folderId ? `'${folderId}' in parents and ` : "";
  const query = encodeURIComponent(
    `${folderClause}trashed=false and mimeType contains 'image/' and name contains 'email signature'`
  );
  const listRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,mimeType)`
  );
  if (!listRes.ok) return null;

  const data = (await listRes.json()) as {
    files?: Array<{ id?: string; name?: string; mimeType?: string }>;
  };
  const files = data.files || [];
  const exact = files.find((file) => file.id && file.name && isEmailSignatureFileName(file.name));
  const picked = exact || files.find((file) => file.id && file.name);
  if (!picked?.id) return null;

  return {
    id: picked.id,
    name: picked.name || DRIVE_FILE_NAME,
    mimeType: picked.mimeType || "image/jpeg"
  };
}

function localBannerFallback(): EmailSignatureBanner | null {
  try {
    const filePath = path.join(process.cwd(), "public/brand/email-signature-banner.jpg");
    const content = fs.readFileSync(filePath);
    return {
      contentId: EMAIL_SIGNATURE_BANNER_CID,
      filename: "email-signature-banner.jpg",
      mimeType: "image/jpeg",
      content
    };
  } catch {
    return null;
  }
}

/** Load the firm email signature banner from Google Drive (file named "email signature") or local fallback. */
export async function loadEmailSignatureBanner(accessToken: string): Promise<EmailSignatureBanner | null> {
  try {
    const file = await findDriveFileId(accessToken);
    if (!file) return localBannerFallback();

    const mediaRes = await driveFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`
    );
    if (!mediaRes.ok) return localBannerFallback();

    const bytes = Buffer.from(await mediaRes.arrayBuffer());
    if (!bytes.length) return localBannerFallback();

    const ext =
      file.mimeType === "image/png"
        ? "png"
        : file.mimeType === "image/gif"
          ? "gif"
          : file.mimeType === "image/webp"
            ? "webp"
            : "jpg";

    return {
      contentId: EMAIL_SIGNATURE_BANNER_CID,
      // Neutral filename — Drive file is named "email signature" but must not show as attachment.
      filename: `signature-banner.${ext}`,
      mimeType: file.mimeType || "image/jpeg",
      content: bytes
    };
  } catch {
    return localBannerFallback();
  }
}
