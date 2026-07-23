export const RETAINER_BILLING_AUTOPILOT_PREFIX = "RETAINER_BILLING_AUTOPILOT";
export const RETAINER_CHARGE_MARKER_PREFIX = "RETAINER_MONTHLY_CHARGE";

export function retainerBillingAutopilotMarker(clientCode: string, billingDate: string, kind: string): string {
  return `${RETAINER_BILLING_AUTOPILOT_PREFIX}:${clientCode}:${billingDate}:${kind}`;
}

/** Calendar month key for monthly retainer idempotency (YYYY-MM). */
export function retainerBillingPeriodKey(ymd: string): string {
  return String(ymd || "").trim().slice(0, 7);
}

export function retainerMonthlyChargeMarker(clientCode: string, periodKey: string): string {
  return `${RETAINER_CHARGE_MARKER_PREFIX}:${String(clientCode || "").trim().toUpperCase()}:${periodKey}`;
}

export function retainerMonthlyChargeDescription(input: {
  clientCode: string;
  periodKey: string;
  fee: number;
  billingDate: string;
  dueDay?: number | null;
  coverageNote?: string;
}): string {
  const marker = retainerMonthlyChargeMarker(input.clientCode, input.periodKey);
  const monthParts = input.periodKey.split("-");
  const monthDate = `${input.periodKey}-01`;
  const monthLabel = (() => {
    const d = new Date(`${monthDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return input.periodKey;
    return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  })();
  const due =
    input.dueDay != null ? ` Due day ${input.dueDay}.` : "";
  const covered = input.coverageNote ? ` ${input.coverageNote}` : "";
  void monthParts;
  return `Monthly retainership — ${monthLabel} · ₱${Number(input.fee).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}.${due}${covered} (${marker})`;
}

export function ledgerHasRetainerMonthlyCharge(
  entries: Array<{ description?: string; charge?: number }>,
  clientCode: string,
  periodKey: string
): boolean {
  const marker = retainerMonthlyChargeMarker(clientCode, periodKey).toLowerCase();
  return entries.some(
    (row) => (Number(row.charge) || 0) > 0 && String(row.description || "").toLowerCase().includes(marker)
  );
}
