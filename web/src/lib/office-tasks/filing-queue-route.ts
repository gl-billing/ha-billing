/**
 * Route a submitted pleading into the e-filing or physical filing queue.
 */

import type { ClientCaseType } from "@/lib/client-case-type";
import { normalizeClientCaseType } from "@/lib/client-case-type";
import { isInitiatoryPleading } from "@/lib/civil-e-filing";

export type FilingQueueKind = "e-filing" | "physical";

export type FilingRouteDecision = {
  queue: FilingQueueKind;
  /** When true, show a confirm dialog so staff can override (admin / other / ambiguous). */
  requiresConfirm: boolean;
  reason: string;
};

function natureLooksCriminal(nature: string): boolean {
  return /criminal/i.test(nature);
}

function natureLooksCivil(nature: string): boolean {
  return /civil|special\s*civil|special\s*proceeding|annulment/i.test(nature);
}

/**
 * Resolve queue from matter case type + pleading type.
 * Falls back to pleadingCaseNature when case type is missing.
 */
export function resolveFilingQueueRoute(input: {
  caseType?: string | null;
  pleadingType?: string | null;
  pleadingCaseNature?: string | null;
}): FilingRouteDecision {
  const caseType = normalizeClientCaseType(input.caseType) as ClientCaseType | "";
  const initiatory = isInitiatoryPleading(input.pleadingType);
  const nature = String(input.pleadingCaseNature || "").trim();

  if (caseType === "criminal" || (!caseType && natureLooksCriminal(nature))) {
    return {
      queue: "physical",
      requiresConfirm: false,
      reason: "Criminal filings go to registered mail / courier / personal service."
    };
  }

  const civilLike =
    caseType === "civil" ||
    caseType === "annulment" ||
    caseType === "special_civil_action" ||
    caseType === "special_proceeding" ||
    (!caseType && natureLooksCivil(nature));

  if (civilLike) {
    if (initiatory) {
      return {
        queue: "physical",
        requiresConfirm: false,
        reason: "Civil initiatory pleadings use personal service / registered mail (then e-file within 24 hours as needed)."
      };
    }
    return {
      queue: "e-filing",
      requiresConfirm: false,
      reason: "Civil subsequent pleadings require electronic filing."
    };
  }

  // Administrative, labor, other, or unknown — suggest e-filing but allow override.
  return {
    queue: "e-filing",
    requiresConfirm: true,
    reason:
      "Admin / labor / other filings default to e-filing — confirm or switch to registered mail / courier / personal."
  };
}
