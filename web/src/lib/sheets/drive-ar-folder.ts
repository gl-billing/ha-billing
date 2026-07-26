import { getOrCreateDriveCategoryFolderId } from "@/lib/sheets/drive-outbound-pdf";

/** Resolve the Drive folder where acknowledgment receipt PDFs are stored. */
export async function getOrCreateArFolderId(accessToken: string): Promise<string> {
  return getOrCreateDriveCategoryFolderId(accessToken, "ar");
}
