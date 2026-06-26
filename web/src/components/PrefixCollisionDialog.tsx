"use client";

import type { PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";
import { formatCollisionSummary } from "@/lib/sheets/prefix-collision";

type Props = {
  open: boolean;
  busy?: boolean;
  taskPrefix: string;
  clientCode: string;
  matches: PrefixCollisionMatch[];
  onUseExisting: (code: string) => void;
  onCreateSeparate: () => void;
  onCancel: () => void;
};

export function PrefixCollisionDialog({
  open,
  busy,
  taskPrefix,
  clientCode,
  matches,
  onUseExisting,
  onCreateSeparate,
  onCancel
}: Props) {
  if (!open || !matches.length) return null;

  const primary = matches[0];

  return (
    <div className="reset-dialog-backdrop no-print" role="dialog" aria-modal="true" aria-labelledby="prefix-collision-title">
      <div className="reset-dialog card max-w-lg">
        <p className="view-eyebrow">Client code check</p>
        <h3 id="prefix-collision-title" className="font-display text-xl font-semibold text-ink">
          This may match an existing matter
        </h3>
        <p className="mt-2 text-sm text-muted">
          Code <strong>{clientCode}</strong> uses task prefix <strong>{taskPrefix}</strong>. Tasks and events
          group by that prefix in the office calendar — they can appear together with another client unless you
          keep them separate on purpose.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-ink">
          {matches.slice(0, 4).map((match) => (
            <li
              key={match.code}
              className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30"
            >
              <p className="font-semibold">{formatCollisionSummary(match)}</p>
              <p className="mt-1 text-xs text-muted">
                Task prefix {match.taskPrefix}
                {match.reasons.length ? ` · ${match.reasons.join(" · ")}` : ""}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted">
          Example: <strong>HERNANDEZ</strong> and <strong>GDCI</strong> can look separate in billing but still
          share task grouping if their names/cases map to the same prefix.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="btn-secondary flex-1 text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary flex-1 text-sm"
            disabled={busy}
            onClick={() => onUseExisting(primary.code)}
          >
            Use {primary.code} instead
          </button>
          <button
            type="button"
            className="btn-primary flex-1 text-sm"
            disabled={busy}
            onClick={onCreateSeparate}
          >
            Create separate file
          </button>
        </div>
      </div>
    </div>
  );
}
