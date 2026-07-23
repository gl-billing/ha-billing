import type { LedgerEntry } from "@/lib/gl-config";
import { EVENT_LEDGER_CHARGE_MARKER } from "@/lib/event-ledger-charge";
import { INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER } from "@/lib/intake-acceptance-fee";
import {
  SPOT_BILLING_CHARGE_MARKER,
  SPOT_BILLING_PAYMENT_MARKER
} from "@/lib/soa-ledger-layout";

/**
 * Staff- and client-facing ledger text must go through this module only.
 *
 * - Sheet/API rows keep raw descriptions (internal markers, chargeRow links).
 * - UI, PDFs, emails, and portal responses call format* helpers below.
 * - Never render entry.description or entry.details directly in JSX.
 */

const EVENT_LEDGER_CHARGE_SUFFIX_RE = new RegExp(
  `\\s*\\(${EVENT_LEDGER_CHARGE_MARKER}:[^)]+\\)\\s*`,
  "gi"
);
const INTAKE_ACCEPTANCE_FEE_SUFFIX_RE = new RegExp(
  `\\s*\\(${INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER}\\)\\s*`,
  "gi"
);
const SPOT_BILLING_MARKER_SUFFIX_RE = new RegExp(
  `\\s*\\((?:${SPOT_BILLING_CHARGE_MARKER}|${SPOT_BILLING_PAYMENT_MARKER}):[^)]+\\)\\s*`,
  "gi"
);

/** Stored in payment details (column I) to link a payment to a charge ledger row. */
export const LEDGER_CHARGE_ROW_PATTERN = /chargeRow:(\d+)/i;

/** Hide internal ledger link markers from staff and client-facing UI. */
export function displayLedgerDescription(description: string): string {
  return String(description || "")
    .replace(EVENT_LEDGER_CHARGE_SUFFIX_RE, " ")
    .replace(INTAKE_ACCEPTANCE_FEE_SUFFIX_RE, " ")
    .replace(SPOT_BILLING_MARKER_SUFFIX_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Hide internal open-charge link from payment reference / details fields. */
export function displayLedgerDetails(details: string): string {
  return String(details || "")
    .replace(LEDGER_CHARGE_ROW_PATTERN, "")
    .replace(/\s*\|\s*\|\s*/g, " | ")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();
}

/** Staff-facing text for audit log lines that may include ledger link markers. */
export function displayAuditLogDetails(details: string): string {
  return displayLedgerDetails(displayLedgerDescription(details));
}

/** Any money-related label shown to staff (payments, charges, AR queue). */
export function displayStaffMoneyLabel(text: string): string {
  return displayLedgerDescription(text);
}

/** @deprecated Use displayLedgerDetails */
export const displayPaymentDetails = displayLedgerDetails;

function extractLedgerDescriptionMarkers(description: string): string[] {
  const markers: string[] = [];
  const event = String(description || "").match(
    new RegExp(`\\(${EVENT_LEDGER_CHARGE_MARKER}:[^)]+\\)`, "i")
  );
  if (event) markers.push(event[0]);
  const intake = String(description || "").match(
    new RegExp(`\\(${INTAKE_ACCEPTANCE_FEE_LEDGER_MARKER}\\)`, "i")
  );
  if (intake) markers.push(intake[0]);
  const spot = String(description || "").match(
    new RegExp(
      `\\((?:${SPOT_BILLING_CHARGE_MARKER}|${SPOT_BILLING_PAYMENT_MARKER}):[^)]+\\)`,
      "i"
    )
  );
  if (spot) markers.push(spot[0]);
  return markers;
}

/** Keep event/intake markers when staff edit the visible description text. */
export function preserveLedgerDescriptionMarkers(edited: string, stored: string): string {
  const visible = displayLedgerDescription(edited).trim();
  const markers = extractLedgerDescriptionMarkers(stored);
  if (!markers.length) return visible;
  return `${visible} ${markers.join(" ")}`.trim();
}

export function parseAppliedChargeRow(details: string): number | null {
  const match = details.match(LEDGER_CHARGE_ROW_PATTERN);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isFinite(row) && row > 0 ? row : null;
}

export function formatPaymentDetailsWithChargeRow(userDetails: string, chargeRow: number): string {
  const marker = `chargeRow:${chargeRow}`;
  const trimmed = userDetails.trim();
  if (!trimmed) return marker;
  if (LEDGER_CHARGE_ROW_PATTERN.test(trimmed)) {
    return trimmed.replace(LEDGER_CHARGE_ROW_PATTERN, marker);
  }
  return `${trimmed} | ${marker}`;
}

/** Keep open-charge link when staff edit the visible reference text. */
export function preserveChargeRowMarker(nextDetails: string, storedDetails: string): string {
  const chargeRow = parseAppliedChargeRow(storedDetails);
  if (!chargeRow) return nextDetails.trim();
  const cleaned = nextDetails.trim();
  if (LEDGER_CHARGE_ROW_PATTERN.test(cleaned)) return cleaned;
  return formatPaymentDetailsWithChargeRow(cleaned, chargeRow);
}

type LedgerLineFields = Pick<LedgerEntry, "type" | "category" | "description" | "details">;

/** Primary label for a ledger row (history, timeline, portal, SOA). */
export function formatLedgerEntryLabel(
  entry: Pick<LedgerLineFields, "type" | "category" | "description">
): string {
  const type = String(entry.type || "").toLowerCase();
  const fallback = type === "payment" ? "Payment" : type === "charge" ? "Charge" : "—";
  return displayLedgerDescription(entry.description || entry.category || fallback);
}

/** Category subtitle when it adds context beyond the main label. */
export function formatLedgerEntrySubtitle(
  entry: Pick<LedgerLineFields, "category" | "description">
): string | null {
  const label = formatLedgerEntryLabel({ ...entry, type: "charge" });
  const category = String(entry.category || "").trim();
  if (!category) return null;
  if (category.toLowerCase() === label.toLowerCase()) return null;
  if (displayLedgerDescription(entry.description || "").toLowerCase() === category.toLowerCase()) {
    return null;
  }
  return category;
}

/** Payment reference / details line for ledger history meta rows. */
export function formatLedgerEntryDetails(
  entry: Pick<LedgerLineFields, "details">
): string | null {
  const text = displayLedgerDetails(entry.details);
  return text || null;
}

/** Values for edit dialogs — markers stripped so staff only see human text. */
export function prepareLedgerEntryForEdit(
  entry: Pick<LedgerLineFields, "description" | "details">
): { description: string; details: string } {
  return {
    description: displayLedgerDescription(entry.description),
    details: displayLedgerDetails(entry.details)
  };
}

/** Merge staff edits back onto stored row without dropping internal links. */
export function preserveLedgerEntryOnSave(
  edited: Pick<LedgerLineFields, "description" | "details">,
  stored: Pick<LedgerLineFields, "description" | "details">
): Pick<LedgerLineFields, "description" | "details"> {
  return {
    description: preserveLedgerDescriptionMarkers(edited.description, stored.description),
    details: preserveChargeRowMarker(edited.details, stored.details)
  };
}
