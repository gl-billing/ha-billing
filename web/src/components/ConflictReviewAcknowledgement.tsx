"use client";

import { ConflictMatchList } from "@/components/ConflictWarningCard";
import type { PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";
import type { ConflictReviewChoice } from "@/lib/sheets/client-code-check";

type Props = {
  choice: ConflictReviewChoice | null;
  onChoiceChange: (choice: ConflictReviewChoice | null) => void;
  subject: string;
  matches: PrefixCollisionMatch[];
  onUseExistingCode?: (code: string) => void;
};

export function ConflictReviewAcknowledgement({
  choice,
  onChoiceChange,
  subject,
  matches,
  onUseExistingCode
}: Props) {
  const label = subject.trim() || "this client";

  return (
    <fieldset className="conflict-review">
      <legend className="conflict-review__legend">How does this relate to the possible conflict?</legend>

      <label
        className={`conflict-review__option ${choice === "same_case" ? "conflict-review__option--selected" : ""}`}
      >
        <input
          type="radio"
          name="conflictReviewChoice"
          checked={choice === "same_case"}
          onChange={() => onChoiceChange("same_case")}
        />
        <span className="conflict-review__copy">
          <span className="conflict-review__text">
            I reviewed the possible conflict — this is the <strong>same case</strong>.
          </span>
          <span className="conflict-review__hint">
            Do not create a new client tab. Use an existing client code below and open that matter instead.
          </span>
        </span>
      </label>

      {choice === "same_case" ? (
        <div className="conflict-review__matches">
          <ConflictMatchList matches={matches} onUseExistingCode={onUseExistingCode} limit={5} />
        </div>
      ) : null}

      <label
        className={`conflict-review__option ${choice === "different_case" ? "conflict-review__option--selected" : ""}`}
      >
        <input
          type="radio"
          name="conflictReviewChoice"
          checked={choice === "different_case"}
          onChange={() => onChoiceChange("different_case")}
        />
        <span className="conflict-review__copy">
          <span className="conflict-review__text">
            I reviewed the possible conflict — this is a <strong>different case</strong>.
          </span>
          <span className="conflict-review__hint">
            Create a separate client tab and ledger for <strong>{label}</strong>.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
