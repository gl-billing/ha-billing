import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { isPleadingCategory, resolveEventCategory } from "@/lib/office-tasks/event-form-utils";
import {
  createPrepChecklistState,
  nextActionForPrepChecklist,
  prepChecklistMarker
} from "@/lib/office-tasks/prep-checklist-storage";

const COMMON_FILING_PREP = [
  "Confirm filing deadline, court, and filing mode (e-filing / personal / registered mail)",
  "Prepare filing fees or proof of payment (if applicable)"
] as const;

const INITIATORY_CIVIL_PREP = [
  "OR / JEPS filing fee",
  "Pleading — all pages printed properly and paginated",
  "Last page of pleading — lawyer signature confirmed",
  "Verification and certification on non-forum shopping — signed by client and notarized by a different lawyer",
  "Annexes",
  "Judicial affidavits — each signed by witness; attestation page signed by lawyer",
  "All judicial affidavits notarized",
  "Notice of entry of appearance"
] as const;

const INITIATORY_CRIMINAL_PREP = [
  "Green form",
  "Complaint affidavit (must not be signed — sign at the OCP)",
  "Affidavit of witnesses",
  "Annexes",
  "Notice of entry of appearance",
  "On filing day — go to OCP"
] as const;

const RESPONSIVE_CIVIL_PREP = [
  "Review received pleading and service date",
  "Confirm computed filing period and deadline",
  "Pleading — last page signed by lawyer",
  "Verification and certification on non-forum shopping — signed by client and notarized by a different lawyer",
  "Affidavit of service of electronic mail",
  "Affidavit of service of registered mail (if required to send registered mail)"
] as const;

const RESPONSIVE_CRIMINAL_PREP = [
  "Review received pleading and service date",
  "Confirm computed filing period and deadline",
  "Pleading — last page signed by lawyer",
  "Verification and certification on non-forum shopping — signed by client and notarized by a different lawyer",
  "Copy furnished filled out before filing to the court",
  "Affidavit of service (personal filing and service)",
  "Affidavit of service of registered mail",
  "After personal service or registered mail — email court within 24 hours"
] as const;

const PREP_BY_CATEGORY: Record<string, readonly string[]> = {
  Submission: ["Compile complete submission package", "Save proof of submission or receipt"],
  Deadline: [
    "Confirm exact deadline date and cutoff time",
    "Complete required action before deadline",
    "Record completion notes in the matter file"
  ]
};

export type PleadingCaseNature = "Civil/Administrative" | "Criminal";

function normalizeCaseNature(raw: unknown): PleadingCaseNature | "" {
  const value = String(raw || "").trim();
  if (value === "Civil/Administrative" || value === "Criminal") return value;
  if (value === "Civil" || value.toLowerCase() === "administrative") return "Civil/Administrative";
  return "";
}

function pleadingPrepItems(pleadingType: string, caseNature: PleadingCaseNature): readonly string[] | null {
  if (pleadingType === "Initiatory pleading") {
    return caseNature === "Criminal" ? INITIATORY_CRIMINAL_PREP : INITIATORY_CIVIL_PREP;
  }
  if (pleadingType === "Responsive pleading") {
    return caseNature === "Criminal" ? RESPONSIVE_CRIMINAL_PREP : RESPONSIVE_CIVIL_PREP;
  }
  return null;
}

export function prepChecklistItemsForEvent(form: EventFormInput): string[] {
  const category = resolveEventCategory(form.category, form.categoryOther);
  if (!isPleadingCategory(category)) return [];

  const pleadingType = String(form.pleadingType || "").trim();
  const caseNature = normalizeCaseNature(form.pleadingCaseNature) || "Civil/Administrative";
  const items: string[] = [];

  const pleadingItems = pleadingPrepItems(pleadingType, caseNature);
  if (pleadingItems) {
    items.push(...pleadingItems);
  }

  const categoryItems = PREP_BY_CATEGORY[category];
  if (categoryItems) {
    for (const item of categoryItems) {
      if (!items.includes(item)) items.push(item);
    }
  }

  for (const item of COMMON_FILING_PREP) {
    if (!items.includes(item)) items.push(item);
  }

  return items;
}

export function formatPrepChecklist(items: readonly string[]): string {
  if (!items.length) return "";
  return items.map((item) => `☐ ${item}`).join("\n");
}

const FILING_PREP_TASK_NEXT_ACTION_NO_CHECKLIST =
  "Prepare the pleading, annexes, and all required copies or sets; confirm everything is ready for filing before the deadline.";

export function buildPrepReminderTaskCopy(
  form: EventFormInput,
  filingDeadline: string,
  daysBefore: number,
  options?: { includeChecklist?: boolean }
): { description: string; nextAction: string; checklistItems: string[]; checklistMarker: string } {
  const category = resolveEventCategory(form.category, form.categoryOther);
  const pleadingType = String(form.pleadingType || "").trim();
  const caseNature = normalizeCaseNature(form.pleadingCaseNature) || "Civil/Administrative";
  const agendaSnippet = String(form.details || "").trim().slice(0, 200);
  const leadLabel = daysBefore === 1 ? "1 day" : `${daysBefore} days`;

  const pleadingLabel =
    pleadingType && caseNature
      ? `${pleadingType.toLowerCase()} (${caseNature.toLowerCase()} case)`
      : category.toLowerCase();
  const header = `Filing prep for ${pleadingLabel} due ${filingDeadline} (this task is due ${leadLabel} before).`;
  const agendaBlock = agendaSnippet ? `\n\nEvent notes:\n${agendaSnippet}` : "";

  if (options?.includeChecklist === false) {
    return {
      description: `${header}${agendaBlock}`,
      nextAction: FILING_PREP_TASK_NEXT_ACTION_NO_CHECKLIST,
      checklistItems: [],
      checklistMarker: ""
    };
  }

  const checklistItems = prepChecklistItemsForEvent(form);
  const checklistState = createPrepChecklistState(checklistItems);

  return {
    description: `${header}${agendaBlock}`,
    nextAction: nextActionForPrepChecklist(checklistState),
    checklistItems,
    checklistMarker: prepChecklistMarker(checklistState)
  };
}
