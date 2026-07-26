import { getOrCreateDriveCategoryFolderId } from "@/lib/sheets/drive-outbound-pdf";

/** Resolve the Drive folder where notarial receipt (NR) PDFs are stored — flat, not monthly. */
export async function getOrCreateNrFolderId(accessToken: string): Promise<string> {
  return getOrCreateDriveCategoryFolderId(accessToken, "nr");
}
