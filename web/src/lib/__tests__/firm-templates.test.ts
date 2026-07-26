import { describe, expect, it } from "vitest";
import {
  TEMPLATE_FOLDERS,
  isAllowedTemplateMime,
  isTemplateFolderId,
  templateFolderById
} from "@/lib/firm-templates";

describe("firm-templates catalog", () => {
  it("includes the six desk folders", () => {
    expect(TEMPLATE_FOLDERS.map((folder) => folder.id)).toEqual([
      "affidavits",
      "spas",
      "contracts",
      "deeds",
      "legal-services",
      "letters"
    ]);
    expect(templateFolderById("legal-services").label).toContain("Retainership");
  });

  it("validates folder ids and upload mime types", () => {
    expect(isTemplateFolderId("contracts")).toBe(true);
    expect(isTemplateFolderId("not-a-folder")).toBe(false);
    expect(isAllowedTemplateMime("application/pdf", "spa.pdf")).toBe(true);
    expect(isAllowedTemplateMime("", "retainer.docx")).toBe(true);
    expect(isAllowedTemplateMime("image/png", "scan.png")).toBe(false);
  });
});
