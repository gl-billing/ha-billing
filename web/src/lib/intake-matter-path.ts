import type { ClientMatterType } from "@/lib/client-matter-type";

/** First intake question — how staff classifies the new matter. */
export type IntakeMatterPath = "new_case" | "pending_case" | "retainer";

export const INTAKE_MATTER_PATH_OPTIONS: Array<{
  value: IntakeMatterPath;
  label: string;
  hint: string;
}> = [
  {
    value: "new_case",
    label: "New case",
    hint: "Retained but not yet filed — prepare pleadings, gather documents, or send demand letters."
  },
  {
    value: "pending_case",
    label: "Pending case",
    hint: "Already in court — case number, court, hearings, and responsive pleadings apply."
  },
  {
    value: "retainer",
    label: "Retainer",
    hint: "Ongoing advice — retainer fee and monthly due date; no active litigation caption required."
  }
];

export const INTAKE_MATTER_STAGE_LABELS: Record<IntakeMatterPath, string> = {
  new_case: "New case",
  pending_case: "Pending case",
  retainer: "Retainer"
};

export const INTAKE_CASE_PREP_TASK = "Case prep";

export function normalizeIntakeMatterPath(value: unknown): IntakeMatterPath | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "new_case" || raw === "new case" || raw === "new") return "new_case";
  if (raw === "pending_case" || raw === "pending case" || raw === "pending") return "pending_case";
  if (raw === "retainer") return "retainer";
  return null;
}

export function intakePathToMatterType(path: IntakeMatterPath): ClientMatterType {
  return path === "retainer" ? "retainer" : "case";
}

export function intakePathRequiresCaseCaption(path: IntakeMatterPath): boolean {
  return path === "new_case" || path === "pending_case";
}

export function intakePathRequiresCourtDetails(path: IntakeMatterPath): boolean {
  return path === "pending_case";
}

export function formatMatterStageLabel(stage: string | null | undefined): string | null {
  const path = normalizeIntakeMatterPath(stage);
  if (path) return INTAKE_MATTER_STAGE_LABELS[path];
  const raw = stage?.trim();
  if (!raw) return null;
  if (/^appeal$/i.test(raw)) return "Appeal";
  return raw;
}

/** Next calendar date for a monthly retainer due day (1–28). */
export function nextRetainerDueDateYmd(dueDay: number, from = new Date()): string {
  const day = Math.min(28, Math.max(1, Math.floor(dueDay) || 1));
  const year = from.getFullYear();
  const month = from.getMonth();
  const candidate = new Date(year, month, day);
  const start = new Date(year, month, from.getDate());
  if (candidate < start) {
    const next = new Date(year, month + 1, day);
    return formatLocalYmd(next);
  }
  return formatLocalYmd(candidate);
}

function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
