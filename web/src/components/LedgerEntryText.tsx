import type { LedgerEntry } from "@/lib/gl-config";
import {
  formatLedgerEntryDetails,
  formatLedgerEntryLabel,
  formatLedgerEntrySubtitle
} from "@/lib/ledger-display";

type LedgerLine = Pick<LedgerEntry, "type" | "category" | "description" | "details">;

type Props = {
  entry: LedgerLine;
  /** label-only = main line text with no wrapper; block = label + optional category subtitle */
  variant?: "block" | "label-only";
  className?: string;
  labelClassName?: string;
  subtitleClassName?: string;
};

/** Human-readable ledger line text — always use this instead of entry.description in UI. */
export function LedgerEntryText({
  entry,
  variant = "block",
  className,
  labelClassName = "text-ink",
  subtitleClassName = "text-xs text-muted"
}: Props) {
  const label = formatLedgerEntryLabel(entry);

  if (variant === "label-only") {
    return <>{label}</>;
  }

  const subtitle = formatLedgerEntrySubtitle(entry);

  return (
    <div className={className}>
      <p className={labelClassName}>{label}</p>
      {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
    </div>
  );
}

/** Payment reference / details line (chargeRow markers hidden). */
export function LedgerEntryDetailsText({
  entry,
  className = "col-span-2"
}: {
  entry: Pick<LedgerLine, "details">;
  className?: string;
}) {
  const details = formatLedgerEntryDetails(entry);
  if (!details) return null;
  return <span className={className}>Details: {details}</span>;
}
