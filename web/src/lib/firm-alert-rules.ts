export type FirmAlertRules = {
  /** Collection follow-up window (days ahead). */
  followUpHorizonDays: number;
  /** Filing confirmation alerts within this many days of deadline. */
  filingAlertHorizonDays: number;
  /** Minimum client balance to surface in alerts. */
  balanceAlertMin: number;
  /** Minimum balance for overdue client alerts. */
  overdueBalanceMin: number;
};

export const DEFAULT_FIRM_ALERT_RULES: FirmAlertRules = {
  followUpHorizonDays: 7,
  filingAlertHorizonDays: 21,
  balanceAlertMin: 1,
  overdueBalanceMin: 1
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function mergeFirmAlertRules(
  partial?: Partial<FirmAlertRules> | null,
  base: FirmAlertRules = DEFAULT_FIRM_ALERT_RULES
): FirmAlertRules {
  if (!partial) return base;
  return {
    followUpHorizonDays: parsePositiveInt(String(partial.followUpHorizonDays ?? base.followUpHorizonDays), base.followUpHorizonDays),
    filingAlertHorizonDays: parsePositiveInt(
      String(partial.filingAlertHorizonDays ?? base.filingAlertHorizonDays),
      base.filingAlertHorizonDays
    ),
    balanceAlertMin: parsePositiveInt(String(partial.balanceAlertMin ?? base.balanceAlertMin), base.balanceAlertMin),
    overdueBalanceMin: parsePositiveInt(String(partial.overdueBalanceMin ?? base.overdueBalanceMin), base.overdueBalanceMin)
  };
}
