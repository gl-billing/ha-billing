import type { ClientSummary } from "@/lib/gl-config";

export type ClientMatterType = "case" | "retainer" | "general";

export const CLIENT_MATTER_TYPE_LABELS: Record<ClientMatterType, string> = {
  case: "Active case",
  retainer: "Retainer client",
  general: "No active case"
};

export const CLIENT_MATTER_TYPE_HINTS: Record<ClientMatterType, string> = {
  case: "Litigation or a named matter — enter the case title below.",
  retainer: "On retainer for ongoing advice — no case caption needed.",
  general: "Frequent or general client — billing file only, no active case."
};

const LEGACY_GENERAL_TITLES = new Set(["general matter", "general client", "no active case", "no case"]);

export function normalizeClientMatterType(value: unknown): ClientMatterType {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "retainer" || raw === "retainer client") return "retainer";
  if (raw === "general" || raw === "no case" || raw === "no active case") return "general";
  if (raw === "case" || raw === "active case") return "case";
  return "case";
}

export function resolveClientMatterType(input: {
  matterType?: string | null;
  caseTitle?: string | null;
  retainerBalance?: number | null;
}): ClientMatterType {
  const stored = String(input.matterType ?? "").trim();
  if (stored) return normalizeClientMatterType(stored);

  const title = String(input.caseTitle ?? "").trim();
  if (title && !LEGACY_GENERAL_TITLES.has(title.toLowerCase())) {
    return "case";
  }
  if ((input.retainerBalance ?? 0) > 0.005) return "retainer";
  if (!title) return "general";
  return "general";
}

/** Task / sheet case label segment (not the full Re: caption). */
export function matterTypeCaseLabel(matterType: ClientMatterType, caseTitle?: string | null): string {
  if (matterType === "retainer") return "Retainer";
  if (matterType === "general") return "";
  return String(caseTitle ?? "").trim();
}

/** Header subtitle — e.g. Re: Annulment, Retainer client, No active case. */
export function formatMatterCaseCaption(input: {
  matterType?: ClientMatterType | string | null;
  caseTitle?: string | null;
  retainerBalance?: number | null;
}): string | null {
  const matterType = resolveClientMatterType({
    matterType: input.matterType,
    caseTitle: input.caseTitle,
    retainerBalance: input.retainerBalance
  });

  if (matterType === "retainer") return CLIENT_MATTER_TYPE_LABELS.retainer;
  if (matterType === "general") return CLIENT_MATTER_TYPE_LABELS.general;

  const title = String(input.caseTitle ?? "").trim();
  if (!title || LEGACY_GENERAL_TITLES.has(title.toLowerCase())) return null;
  if (/^re:\s*/i.test(title)) return title;
  return `Re: ${title}`;
}

/** Directory table / list — short case column label. */
export function formatMatterDirectoryCaseLabel(client: Pick<ClientSummary, "matterType" | "caseTitle" | "retainerBalance">): string {
  const matterType = resolveClientMatterType(client);
  if (matterType === "retainer") return CLIENT_MATTER_TYPE_LABELS.retainer;
  if (matterType === "general") return CLIENT_MATTER_TYPE_LABELS.general;
  const title = String(client.caseTitle ?? "").trim();
  if (!title || LEGACY_GENERAL_TITLES.has(title.toLowerCase())) return "—";
  return title;
}

export function caseTitleRequiredForMatterType(matterType: ClientMatterType): boolean {
  return matterType === "case";
}
