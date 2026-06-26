import { FIELD_DISPATCH_TRAVEL_HOURS } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";

export type LitigationVenueTier =
  | "davao_city"
  | "nearby"
  | "regional"
  | "south_central"
  | "extended"
  | "north_east"
  | "far";

export type LitigationFeeSchedule = {
  tier: LitigationVenueTier;
  acceptanceFee: number;
  appearanceFee: number;
  venueLabel: string;
  travelHours: number;
  matchedLocation: string | null;
};

type FeeBand = {
  tier: LitigationVenueTier;
  maxHours: number;
  acceptanceFee: number;
  appearanceFee: number;
  venueLabel: string;
};

/** Acceptance and appearance fees increase with travel time from Davao City. */
const LITIGATION_FEE_BANDS: FeeBand[] = [
  {
    tier: "davao_city",
    maxHours: 0,
    acceptanceFee: 5000,
    appearanceFee: 5000,
    venueLabel: "within Davao City"
  },
  {
    tier: "nearby",
    maxHours: 1.25,
    acceptanceFee: 12000,
    appearanceFee: 12000,
    venueLabel: "in Digos, Panabo, Tagum, and nearby Davao Region venues"
  },
  {
    tier: "regional",
    maxHours: 2,
    acceptanceFee: 15000,
    appearanceFee: 15000,
    venueLabel: "in Kidapawan, Nabunturan, Compostela, Monkayo, and similar regional venues"
  },
  {
    tier: "south_central",
    maxHours: 2.75,
    acceptanceFee: 18000,
    appearanceFee: 18000,
    venueLabel: "in Koronadal, General Santos, and south-central Mindanao venues"
  },
  {
    tier: "extended",
    maxHours: 3.5,
    acceptanceFee: 20000,
    appearanceFee: 20000,
    venueLabel: "in Mati, Cotabato City, Valencia, and similar extended-area venues"
  },
  {
    tier: "north_east",
    maxHours: 5,
    acceptanceFee: 22000,
    appearanceFee: 22000,
    venueLabel: "in Malaybalay, Cagayan de Oro, and north-eastern Mindanao venues"
  },
  {
    tier: "far",
    maxHours: Number.POSITIVE_INFINITY,
    acceptanceFee: 25000,
    appearanceFee: 25000,
    venueLabel: "in Butuan and other far venues from Davao City"
  }
];

type VenueMatch = {
  pattern: RegExp;
  location: keyof typeof FIELD_DISPATCH_TRAVEL_HOURS;
};

/** Longer / more specific patterns first. */
const VENUE_MATCHERS: VenueMatch[] = [
  { pattern: /davao\s*city|city\s*of\s*davao/, location: "Davao City" },
  { pattern: /\bpanabo\b/, location: "Panabo" },
  { pattern: /\bcarmen\b/, location: "Carmen" },
  { pattern: /\bdigos\b/, location: "Digos" },
  { pattern: /santa\s+cruz/, location: "Santa Cruz" },
  { pattern: /\btagum\b/, location: "Tagum" },
  { pattern: /kidapawan/, location: "Kidapawan" },
  { pattern: /nabunturan/, location: "Nabunturan" },
  { pattern: /compostela/, location: "Compostela" },
  { pattern: /monkayo/, location: "Monkayo" },
  { pattern: /koronadal/, location: "Koronadal" },
  { pattern: /general\s+santos|\bgensan\b/, location: "General Santos" },
  { pattern: /\bmati\b/, location: "Mati" },
  { pattern: /cotabato\s*city|\bcotabato\b/, location: "Cotabato City" },
  { pattern: /valencia/, location: "Valencia" },
  { pattern: /malaybalay/, location: "Malaybalay" },
  { pattern: /cagayan\s*de\s*oro|\bcdo\b/, location: "Cagayan de Oro" },
  { pattern: /\bbutuan\b/, location: "Butuan" },
  { pattern: /davao\s*del\s*norte/, location: "Tagum" },
  { pattern: /davao\s*del\s*sur/, location: "Digos" },
  { pattern: /davao\s*de\s*oro|compostela\s*valley/, location: "Nabunturan" },
  { pattern: /davao\s*oriental/, location: "Mati" }
];

function feeBandForTravelHours(hours: number): FeeBand {
  for (const band of LITIGATION_FEE_BANDS) {
    if (hours <= band.maxHours) return band;
  }
  return LITIGATION_FEE_BANDS[LITIGATION_FEE_BANDS.length - 1];
}

function matchVenueLocation(courtPending: string): keyof typeof FIELD_DISPATCH_TRAVEL_HOURS | null {
  const normalized = courtPending.trim().toLowerCase();
  if (!normalized) return null;

  for (const matcher of VENUE_MATCHERS) {
    if (matcher.pattern.test(normalized)) {
      return matcher.location;
    }
  }

  return null;
}

function travelHoursForCourt(courtPending: string): { hours: number; matchedLocation: string | null } {
  const matchedLocation = matchVenueLocation(courtPending);
  if (matchedLocation) {
    return {
      hours: FIELD_DISPATCH_TRAVEL_HOURS[matchedLocation] ?? FIELD_DISPATCH_TRAVEL_HOURS.Other,
      matchedLocation
    };
  }

  return {
    hours: FIELD_DISPATCH_TRAVEL_HOURS.Other,
    matchedLocation: null
  };
}

/** Map court / venue text from intake to the firm's litigation fee schedule. */
export function resolveLitigationFeeSchedule(courtPending = ""): LitigationFeeSchedule {
  const { hours, matchedLocation } = travelHoursForCourt(courtPending);
  const band = feeBandForTravelHours(hours);

  return {
    tier: band.tier,
    acceptanceFee: band.acceptanceFee,
    appearanceFee: band.appearanceFee,
    venueLabel: matchedLocation
      ? `${band.venueLabel} (${matchedLocation})`
      : courtPending.trim()
        ? `${band.venueLabel} (based on venue area)`
        : band.venueLabel,
    travelHours: hours,
    matchedLocation
  };
}

export const CONTRACT_ACCEPTANCE_MIN = 100_000;
export const NULLITY_ACCEPTANCE_NEAR = 250_000;
export const NULLITY_ACCEPTANCE_FAR = 350_000;

const NULLITY_CASE_RE =
  /(?:declaration|petition)\s+for\s+(?:declaration\s+of\s+)?nullity\s+of\s+marriage|nullity\s+of\s+marriage/i;

const ANNULMENT_CASE_RE = /annulment(?:\s+of\s+marriage)?/i;

export function isDeclarationOfNullityCase(caseTitle: string): boolean {
  return NULLITY_CASE_RE.test(String(caseTitle || "").trim());
}

export function isAnnulmentCase(caseTitle: string): boolean {
  return ANNULMENT_CASE_RE.test(String(caseTitle || "").trim());
}

/** Nullity or annulment — psychologist details apply to both. */
export function isMarriageNullityOrAnnulmentCase(caseTitle: string): boolean {
  return isDeclarationOfNullityCase(caseTitle) || isAnnulmentCase(caseTitle);
}

export type ContractAcceptanceFee = {
  acceptanceFee: number;
  tierLabel: string;
  isNullityCase: boolean;
};

/** Contract acceptance fee — minimum ₱100,000; nullity of marriage ₱250,000 or ₱350,000 by venue. */
export function resolveContractAcceptanceFee(caseTitle: string, courtPending = ""): ContractAcceptanceFee {
  if (isDeclarationOfNullityCase(caseTitle)) {
    const schedule = resolveLitigationFeeSchedule(courtPending);
    const nearby = schedule.tier === "davao_city" || schedule.tier === "nearby";
    return {
      acceptanceFee: nearby ? NULLITY_ACCEPTANCE_NEAR : NULLITY_ACCEPTANCE_FAR,
      tierLabel: nearby
        ? "declaration of nullity of marriage — Davao City and nearby venues"
        : "declaration of nullity of marriage — regional and farther venues",
      isNullityCase: true
    };
  }

  return {
    acceptanceFee: CONTRACT_ACCEPTANCE_MIN,
    tierLabel: "acceptance fee",
    isNullityCase: false
  };
}

export function contractAcceptanceFeeSummary(caseTitle: string, courtPending = ""): string {
  const fee = resolveContractAcceptanceFee(caseTitle, courtPending);
  return `Acceptance ${formatPeso(fee.acceptanceFee)}`;
}

export type LitigationAppearanceFeeRow = {
  tier: LitigationVenueTier;
  filingArea: string;
  exampleCourts: string;
  appearanceFee: number;
  appearanceFeeLabel: string;
};

const APPEARANCE_EXAMPLE_COURTS: Record<LitigationVenueTier, string> = {
  davao_city: "RTC / MTCC, Davao City",
  nearby: "Digos, Panabo, Tagum, Carmen, Santa Cruz",
  regional: "Kidapawan, Nabunturan, Compostela, Monkayo",
  south_central: "Koronadal, General Santos",
  extended: "Mati, Cotabato City, Valencia",
  north_east: "Malaybalay, Cagayan de Oro",
  far: "Butuan and farther venues"
};

/** Intake table — filing area and appearance fee only (not printed in full on the contract). */
export function litigationAppearanceFeeRowsForIntake(): LitigationAppearanceFeeRow[] {
  return LITIGATION_FEE_BANDS.map((band) => ({
    tier: band.tier,
    filingArea: band.venueLabel,
    exampleCourts: APPEARANCE_EXAMPLE_COURTS[band.tier],
    appearanceFee: band.appearanceFee,
    appearanceFeeLabel: formatPeso(band.appearanceFee)
  }));
}

export function formatLitigationAcceptanceFee(amount: number): string {
  return formatPeso(amount);
}

export function litigationFeeScheduleSummary(courtPending = ""): string {
  const schedule = resolveLitigationFeeSchedule(courtPending);
  return `Appearance ${formatPeso(schedule.appearanceFee)} (${schedule.venueLabel})`;
}

/** Fee table for contract reference — increases by area / travel from Davao City. */
export function litigationFeeScheduleTable(): Array<{
  area: string;
  acceptanceFee: string;
  appearanceFee: string;
}> {
  return LITIGATION_FEE_BANDS.map((band) => ({
    area: band.venueLabel,
    acceptanceFee: formatPeso(band.acceptanceFee),
    appearanceFee: formatPeso(band.appearanceFee)
  }));
}
