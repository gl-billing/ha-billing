/**
 * Drive vault UI folder taxonomy — safe for client components.
 * Mirrors DrivePdfCategory / FirmPdfDocumentType in drive-outbound-pdf.ts
 * (SOA/AR still save to Drive; they are not dedicated vault UI folders).
 */

export type DriveVaultFolderId =
  | "all"
  | "nr"
  | "correspondence"
  | "engagement"
  | "spot"
  | "status-report"
  | "payslip"
  | "other";

export const DRIVE_VAULT_FOLDERS: { id: DriveVaultFolderId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "status-report", label: "Status Reports" },
  { id: "nr", label: "NR" },
  { id: "correspondence", label: "Correspondence" },
  { id: "engagement", label: "Engagement" },
  { id: "spot", label: "Spot" },
  { id: "payslip", label: "Payslips" },
  { id: "other", label: "Other" }
];

/** Classify a Document Log type into a Drive vault folder. */
export function driveVaultFolderForDocumentType(documentType: string): Exclude<DriveVaultFolderId, "all"> {
  const type = String(documentType || "").toUpperCase();
  if (type.includes("STATUS")) return "status-report";
  if (type === "NR" || type.includes("NOTAR")) return "nr";
  if (type.includes("CORRESPONDENCE") || (type.includes("LETTER") && !type.includes("ENGAGEMENT"))) {
    return "correspondence";
  }
  if (type.includes("ENGAGEMENT") || type.includes("CONTRACT") || type.includes("RETAINERSHIP")) {
    return "engagement";
  }
  if (type.includes("SPOT")) return "spot";
  if (type.includes("PAYSLIP") || type.includes("PAYROLL")) return "payslip";
  // SOA / AR and unrecognized types land under Other (still visible in All).
  return "other";
}

export function matchesDriveVaultFolder(documentType: string, folder: DriveVaultFolderId): boolean {
  if (folder === "all") return true;
  return driveVaultFolderForDocumentType(documentType) === folder;
}
