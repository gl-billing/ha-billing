"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import type { PostedLedgerChargeNotice } from "@/lib/ledger-charge-notices";
import { matterLedgerLabel } from "@/lib/ledger-charge-notices";
import { matterHref } from "@/lib/matter-routes";
import { formatBillingPeso } from "@/lib/billing-document-design";

type Props = {
  notice: PostedLedgerChargeNotice;
  linkToBilling?: boolean;
  /** Slim inline line for matter-page event rows; full card for edit dialogs. */
  variant?: "full" | "compact";
};

export function PostedLedgerChargeNote({
  notice,
  linkToBilling = true,
  variant = "full"
}: Props) {
  const matter = notice.matterLabel
    ? matterLedgerLabel(notice.matterCode, notice.matterLabel)
    : notice.matterCode;

  if (variant === "compact") {
    return (
      <p className="posted-ledger-charge-note posted-ledger-charge-note--compact" role="status">
        <span className="posted-ledger-charge-note__compact-label">On ledger</span>
        <span className="posted-ledger-charge-note__compact-amount amount-serif">
          {formatBillingPeso(notice.amount)}
        </span>
        <span className="posted-ledger-charge-note__compact-sep" aria-hidden="true">
          ·
        </span>
        <span className="posted-ledger-charge-note__compact-date">posted {notice.postedDate}</span>
      </p>
    );
  }

  return (
    <div className="posted-ledger-charge-note" role="status">
      <p className="posted-ledger-charge-note__eyebrow">Client ledger</p>
      <p className="posted-ledger-charge-note__title font-display">{notice.title}</p>
      <p className="posted-ledger-charge-note__amount amount-serif">{formatBillingPeso(notice.amount)}</p>
      <p className="posted-ledger-charge-note__body">{notice.body}</p>
      <p className="posted-ledger-charge-note__meta">
        Matter <span className="posted-ledger-charge-note__matter-code">{matter}</span>
        <span className="posted-ledger-charge-note__sep" aria-hidden="true">
          ·
        </span>
        Ledger entry dated <span className="posted-ledger-charge-note__date">{notice.postedDate}</span>
      </p>
      {linkToBilling ? (
        <SameWindowLink
          href={matterHref(notice.matterCode, "billing")}
          className="posted-ledger-charge-note__link"
        >
          Open matter billing ledger
        </SameWindowLink>
      ) : null}
    </div>
  );
}
