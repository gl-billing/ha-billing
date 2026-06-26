import { NextResponse } from "next/server";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { getOrCreateNrFolderId } from "@/lib/sheets/drive-nr-folder";
import { readSettingsMap } from "@/lib/sheets/settings";

export async function GET() {
  try {
    const accessToken = await requireBillingAccessToken();
    const settings = await readSettingsMap(accessToken);
    const configured =
      settings.get("NR Folder ID")?.trim() ||
      settings.get("Notarial Receipt Folder ID")?.trim() ||
      "";

    const folderId = await getOrCreateNrFolderId(accessToken);

    return NextResponse.json({
      ok: true,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      configuredInSettings: configured || null,
      hint: configured
        ? "Using NR Folder ID from your Settings tab."
        : "Auto-detected or created Notarial Receipts folder. Add NR Folder ID in Settings if you want a specific folder."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve NR folder.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
