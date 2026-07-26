/** Shared Templates library folder catalog (client + server). */

export type TemplateFolderId =
  | "affidavits"
  | "spas"
  | "contracts"
  | "deeds"
  | "legal-services"
  | "letters";

export type TemplateFolderDef = {
  id: TemplateFolderId;
  label: string;
  /** Drive folder name */
  driveName: string;
  description: string;
};

export const TEMPLATE_FOLDERS: TemplateFolderDef[] = [
  {
    id: "affidavits",
    label: "Affidavits",
    driveName: "Affidavits",
    description: "Sworn statements and affidavit forms"
  },
  {
    id: "spas",
    label: "SPAs",
    driveName: "SPAs",
    description: "Special powers of attorney"
  },
  {
    id: "contracts",
    label: "Contracts",
    driveName: "Contracts",
    description: "Agreements and contract drafts"
  },
  {
    id: "deeds",
    label: "Deeds",
    driveName: "Deeds",
    description: "Deeds of sale, donation, and related instruments"
  },
  {
    id: "legal-services",
    label: "Legal Services / Retainership",
    driveName: "Legal Services - Retainership",
    description: "Engagement letters, retainers, and service agreements"
  },
  {
    id: "letters",
    label: "Letters",
    driveName: "Letters",
    description: "Demand letters, notices, and correspondence starters"
  }
];

export const TEMPLATE_FOLDER_IDS = TEMPLATE_FOLDERS.map((folder) => folder.id);

export function isTemplateFolderId(value: string): value is TemplateFolderId {
  return TEMPLATE_FOLDER_IDS.includes(value as TemplateFolderId);
}

export function templateFolderById(id: TemplateFolderId): TemplateFolderDef {
  return TEMPLATE_FOLDERS.find((folder) => folder.id === id) || TEMPLATE_FOLDERS[0];
}

/** Max upload size for a single template file (PDF / Word). */
export const MAX_TEMPLATE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const TEMPLATE_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf";

export function isAllowedTemplateMime(mimeType: string, filename: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  const name = filename.trim().toLowerCase();
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/rtf" ||
    mime === "text/rtf"
  ) {
    return true;
  }
  return /\.(pdf|docx?|rtf)$/i.test(name);
}

export type TemplateFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime?: string;
  size?: number;
};
