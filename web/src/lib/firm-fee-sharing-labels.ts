import {
  ACCEPTANCE_FEE_SHARE_PERCENTS,
  APPEARANCE_FEE_LAWYER_SHARE_PERCENT,
  MANAGING_PARTNER,
  PLEADING_FEE_SHARE_PERCENTS
} from "@/lib/firm-team-config";

export function acceptanceFeeSharingSummary(): string {
  return `${ACCEPTANCE_FEE_SHARE_PERCENTS.firm}% firm · ${ACCEPTANCE_FEE_SHARE_PERCENTS.managingPartner}% ${MANAGING_PARTNER.displayName} · ${ACCEPTANCE_FEE_SHARE_PERCENTS.associate}% other lawyer`;
}

export function pleadingFeeSharingSummary(): string {
  return `${PLEADING_FEE_SHARE_PERCENTS.firm}% office · ${PLEADING_FEE_SHARE_PERCENTS.drafter}% drafting lawyer · ${PLEADING_FEE_SHARE_PERCENTS.managingPartner}% ${MANAGING_PARTNER.displayName}`;
}

export function appearanceFeeSharingSummary(): string {
  return `${APPEARANCE_FEE_LAWYER_SHARE_PERCENT}% to the assigned lawyer`;
}
