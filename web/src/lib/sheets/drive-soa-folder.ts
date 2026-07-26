import { getOrCreateDriveCategoryFolderId } from "@/lib/sheets/drive-outbound-pdf";

/** Resolve the Drive folder where SOA PDFs are stored. */
export async function getOrCreateSoaFolderId(accessToken: string): Promise<string> {
  return getOrCreateDriveCategoryFolderId(accessToken, "soa");
}
