import { describe, expect, it } from "vitest";
import {
  DRIVE_VAULT_FOLDERS,
  driveVaultFolderForDocumentType,
  matchesDriveVaultFolder
} from "@/lib/drive-vault-folders";

describe("drive vault folders", () => {
  it("exposes Status Reports and outbound types without dedicated SOA/AR folders", () => {
    const labels = DRIVE_VAULT_FOLDERS.map((f) => f.label);
    expect(labels).not.toContain("SOA");
    expect(labels).not.toContain("AR");
    expect(labels).toContain("Status Reports");
    expect(labels).toContain("Correspondence");
    expect(labels).toContain("Engagement");
    expect(labels).toContain("Spot");
    expect(labels).toContain("NR");
    expect(labels).toContain("Other");
  });

  it("classifies document log types into folders", () => {
    expect(driveVaultFolderForDocumentType("SOA")).toBe("other");
    expect(driveVaultFolderForDocumentType("AR")).toBe("other");
    expect(driveVaultFolderForDocumentType("Status Report")).toBe("status-report");
    expect(driveVaultFolderForDocumentType("NR")).toBe("nr");
    expect(driveVaultFolderForDocumentType("Correspondence")).toBe("correspondence");
    expect(driveVaultFolderForDocumentType("Engagement")).toBe("engagement");
    expect(driveVaultFolderForDocumentType("Contract")).toBe("engagement");
    expect(driveVaultFolderForDocumentType("Spot Charge")).toBe("spot");
    expect(driveVaultFolderForDocumentType("Payslip")).toBe("payslip");
    expect(driveVaultFolderForDocumentType("Unknown")).toBe("other");
  });

  it("matches vault folder filters", () => {
    expect(matchesDriveVaultFolder("SOA", "all")).toBe(true);
    expect(matchesDriveVaultFolder("SOA", "other")).toBe(true);
    expect(matchesDriveVaultFolder("SOA", "status-report")).toBe(false);
    expect(matchesDriveVaultFolder("Status Report", "status-report")).toBe(true);
  });
});
