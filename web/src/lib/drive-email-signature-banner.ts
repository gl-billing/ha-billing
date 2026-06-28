import fs from "fs";
import path from "path";
import { EMAIL_SIGNATURE_BANNER_CID } from "@/lib/firm-email-signature";

export type EmailSignatureBanner = {
  contentId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
};

/** HA billing — Hernandez logo bar on Drive (`cover.png`). Not the GL "email signature" file. */
const HA_DRIVE_BANNER_FILE_NAME = "cover.png";

function configuredFileId(): string | null {
  const id = process.env.FIRM_EMAIL_SIGNATURE_DRIVE_FILE_ID?.trim();
  return id || null;
}

function isHaEmailBannerFileName(name: string): boolean {
  return name.trim().toLowerCase() === HA_DRIVE_BANNER_FILE_NAME;
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
    return { id: meta.id, name: meta.name || HA_DRIVE_BANNER_FILE_NAME, mimeType: meta.mimeType || "image/png" };
  }

  const folderId = process.env.FIRM_EMAIL_SIGNATURE_DRIVE_FOLDER_ID?.trim();
  const folderClause = folderId ? `'${folderId}' in parents and ` : "";
  const query = encodeURIComponent(
    `${folderClause}trashed=false and mimeType contains 'image/' and name = '${HA_DRIVE_BANNER_FILE_NAME}'`
  );
  const listRes = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,mimeType)`
  );
  if (!listRes.ok) return null;

  const data = (await listRes.json()) as {
    files?: Array<{ id?: string; name?: string; mimeType?: string }>;
  };
  const files = data.files || [];
  const exact = files.find((file) => file.id && file.name && isHaEmailBannerFileName(file.name));
  if (!exact?.id) return null;

  return {
    id: exact.id,
    name: exact.name || HA_DRIVE_BANNER_FILE_NAME,
    mimeType: exact.mimeType || "image/png"
  };
}

function localBannerFallback(): EmailSignatureBanner | null {
  const filePath = path.join(process.cwd(), "public/brand/cover.png");
  try {
    const content = fs.readFileSync(filePath);
    return {
      contentId: EMAIL_SIGNATURE_BANNER_CID,
      filename: "cover.png",
      mimeType: "image/png",
      content
    };
  } catch {
    return null;
  }
}

/** Load the HA email signature banner from Google Drive (`cover.png`) or `public/brand/cover.png`. */
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
      filename: `cover.${ext}`,
      mimeType: file.mimeType || "image/png",
      content: bytes
    };
  } catch {
    return localBannerFallback();
  }
}
