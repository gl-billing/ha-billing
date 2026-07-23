/** Internal idempotency markers — stripped from client-facing SOA/UI labels. */
export const SPOT_BILLING_CHARGE_MARKER = "SPOT_BILLING_CHARGE";
export const SPOT_BILLING_PAYMENT_MARKER = "SPOT_BILLING_PAYMENT";

/** Blank ledger lines inserted before each spot-billing block on the SOA PDF. */
export const SOA_SPOT_BILLING_GAP_LINES = 3;

/** Max ledger entry rows per SOA page (readability — not counting gap spacers). */
export const SOA_MAX_LEDGER_ROWS_PER_PAGE = 12;

export function isSpotBillingLedgerDescription(description: string): boolean {
  const text = String(description || "");
  return (
    new RegExp(`${SPOT_BILLING_CHARGE_MARKER}:`, "i").test(text) ||
    new RegExp(`${SPOT_BILLING_PAYMENT_MARKER}:`, "i").test(text) ||
    /\(SPOT-\d+\)/i.test(text)
  );
}

export function spotIdFromLedgerDescription(description: string): string | null {
  const text = String(description || "");
  const marker = text.match(
    new RegExp(`(?:${SPOT_BILLING_CHARGE_MARKER}|${SPOT_BILLING_PAYMENT_MARKER}):(SPOT-\\d+)`, "i")
  );
  if (marker?.[1]) return marker[1].toUpperCase();
  const visible = text.match(/\(SPOT-(\d+)\)/i);
  if (visible?.[1]) return `SPOT-${visible[1].padStart(4, "0")}`;
  return null;
}

export type SoaLedgerLayoutItem =
  | { kind: "row"; index: number }
  | { kind: "gap"; lines: number };

/**
 * Insert gaps before each spot-billing block so occasional charges read as a
 * separate billing section on the SOA (at least three blank lines).
 */
export function buildSoaLedgerLayout(
  rows: Array<{ description?: string }>,
  options?: { gapLines?: number; maxRowsPerPage?: number }
): SoaLedgerLayoutItem[] {
  const gapLines = options?.gapLines ?? SOA_SPOT_BILLING_GAP_LINES;
  const maxRowsPerPage = options?.maxRowsPerPage ?? SOA_MAX_LEDGER_ROWS_PER_PAGE;
  const layout: SoaLedgerLayoutItem[] = [];
  let prevSpotId: string | null = null;
  let rowsOnPage = 0;

  rows.forEach((row, index) => {
    const desc = String(row.description || "");
    const isSpot = isSpotBillingLedgerDescription(desc);
    const spotId = isSpot ? spotIdFromLedgerDescription(desc) : null;
    const startsSpotBlock = isSpot && spotId !== prevSpotId;

    if (startsSpotBlock && index > 0) {
      layout.push({ kind: "gap", lines: gapLines });
    }

    if (rowsOnPage >= maxRowsPerPage) {
      /* Page break is enforced by the PDF renderer via ensureSpace + row budget. */
      rowsOnPage = 0;
    }

    layout.push({ kind: "row", index });
    rowsOnPage += 1;
    prevSpotId = isSpot ? spotId : null;
  });

  return layout;
}
