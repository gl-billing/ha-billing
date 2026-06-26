"use client";

import type { MyWorkScope } from "@/lib/my-work-scope";

type Props = {
  scope: MyWorkScope;
  staffName: string | null;
  practiceMode?: boolean;
  onChange: (scope: MyWorkScope) => void;
};

export function MyWorkScopeToggle({ scope, staffName, practiceMode = false, onChange }: Props) {
  return (
    <div className="my-work-scope no-print">
      <div className="my-work-scope__segment refine-segment" role="group" aria-label="My work view">
        <button
          type="button"
          className={`refine-segment__btn ${scope === "mine" ? "refine-segment__btn--active" : ""}`}
          disabled={!staffName}
          onClick={() => onChange("mine")}
        >
          My items
        </button>
        <button
          type="button"
          className={`refine-segment__btn ${scope === "firm" ? "refine-segment__btn--active" : ""}`}
          onClick={() => onChange("firm")}
        >
          Whole firm
        </button>
      </div>
      <p className="my-work-scope__hint text-xs text-muted">
        {staffName ? (
          scope === "mine" ? (
            practiceMode ? (
              <>
                Practice view — sample items for <strong className="text-ink">{staffName}</strong>
              </>
            ) : (
              <>
                Assigned to <strong className="text-ink">{staffName}</strong>
              </>
            )
          ) : (
            <>All staff — every open item due today or overdue</>
          )
        ) : (
          <>Sign-in could not be matched to the employee roster — showing whole firm.</>
        )}
      </p>
    </div>
  );
}
