import { resolveLitigationFeeSchedule } from "@/lib/litigation-venue-fees";
import {
  hasEventBillingAppearanceMarker,
  hasEventBillingPleadingMarker
} from "@/lib/office-tasks/event-item-links";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";

const ATTORNEY_DETAILS_RE = /ATTORNEY:([^|]+)/i;
const DRAFTER_DETAILS_RE = /DRAFTER:([^|]+)/i;
const SOLE_LAWYER_DETAILS_RE = /SOLE_LAWYER:1/i;

export function eventBillingLedgerDetails(input: {
  eventId: string;
  attorney?: string;
  drafter?: string;
  soleLawyerOnMatter?: boolean;
}): string {
  const parts = [`EVENT:${input.eventId}`];
  if (input.attorney?.trim()) parts.push(`ATTORNEY:${input.attorney.trim()}`);
  if (input.drafter?.trim()) parts.push(`DRAFTER:${input.drafter.trim()}`);
  if (input.soleLawyerOnMatter) parts.push("SOLE_LAWYER:1");
  return parts.join("|");
}

export function parseAppearanceAttorneyFromLedgerDetails(details: string): string {
  return details.match(ATTORNEY_DETAILS_RE)?.[1]?.trim() || "";
}

export function parsePleadingDrafterFromLedgerDetails(details: string): string {
  return details.match(DRAFTER_DETAILS_RE)?.[1]?.trim() || "";
}

export function parseSoleLawyerFromLedgerDetails(details: string): boolean {
  return SOLE_LAWYER_DETAILS_RE.test(details);
}

export function suggestedEventBillingAmount(venueText: string, courtPending = ""): number {
  const schedule = resolveLitigationFeeSchedule(venueText.trim() || courtPending.trim());
  return schedule.appearanceFee;
}

export function buildAppearanceFeeChargeDescription(form: EventFormInput, eventId: string): string {
  const venue = form.venue?.trim();
  const date = form.eventDate || form.filingDeadline || "";
  const summary = form.details.trim() || "Appearance";
  return `Appearance fee — ${summary}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""} (${eventId})`;
}

export function buildPleadingFeeChargeDescription(form: EventFormInput, eventId: string): string {
  const pleading = form.pleadingType?.trim() || form.category;
  const deadline = form.filingDeadline || form.filingDate || "";
  const summary = form.details.trim() || pleading || "Pleading";
  return `Drafting pleading fee — ${summary}${pleading ? ` · ${pleading}` : ""}${deadline ? ` · due ${deadline}` : ""} (${eventId})`;
}

export function eventAlreadyBilledForAppearance(remarks: string): boolean {
  return hasEventBillingAppearanceMarker(remarks);
}

export function eventAlreadyBilledForPleading(remarks: string): boolean {
  return hasEventBillingPleadingMarker(remarks);
}
