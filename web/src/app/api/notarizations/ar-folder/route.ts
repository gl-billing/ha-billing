import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { getSpreadsheetId } from "@/lib/sheets/client";
import { getOrCreateArFolderId } from "@/lib/sheets/drive-ar-folder";
import { readSettingsMap } from "@/lib/sheets/settings";

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const settings = await readSettingsMap(accessToken);
    const configured =
      settings.get("AR Folder ID")?.trim() || settings.get("AR Drive Folder ID")?.trim() || "";

    const folderId = await getOrCreateArFolderId(accessToken);

    return NextResponse.json({
      ok: true,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      configuredInSettings: configured || null,
      spreadsheetId: getSpreadsheetId(),
      hint: configured
        ? "Using AR Folder ID from your Settings tab (client billing ARs — monthly via Apps Script)."
        : "Auto-detected client AR folder. Notarial receipts (NR) use Settings → NR Folder ID instead."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve AR folder.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
