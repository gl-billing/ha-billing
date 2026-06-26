"use client";

import { ConflictReviewAcknowledgement } from "@/components/ConflictReviewAcknowledgement";
import {
  ConflictMatchList,
  ConflictWarningCard,
  ConflictWarningSection
} from "@/components/ConflictWarningCard";
import {
  clientCodeCheckBlocksCreate,
  formatCodeConflictMessage,
  groupCollisionWarnings,
  type ClientCodeCheckResult,
  type ConflictReviewChoice
} from "@/lib/sheets/client-code-check";

type Props = {
  check: ClientCodeCheckResult | null;
  checking?: boolean;
  clientCode?: string;
  clientCaseLabel?: string;
  context?: "intake" | "task-event";
  conflictReviewChoice: ConflictReviewChoice | null;
  onConflictReviewChoiceChange: (value: ConflictReviewChoice | null) => void;
  onUseExistingCode: (code: string) => void;
};

export function ClientCodeWarningPanel({
  check,
  checking = false,
  clientCode = "",
  clientCaseLabel = "",
  context = "intake",
  conflictReviewChoice,
  onConflictReviewChoiceChange,
  onUseExistingCode
}: Props) {
  if (checking) {
    return (
      <ConflictWarningCard
        variant="checking"
        title="Checking for conflicts…"
        eyebrow="Conflict review"
      />
    );
  }

  if (!check) return null;

  const { codeConflict, taskPrefix } = check;
  const { profileMatches, taskGroupingMatches } = groupCollisionWarnings(check);
  const blocked = clientCodeCheckBlocksCreate(check);
  const hasWarnings = profileMatches.length > 0 || taskGroupingMatches.length > 0;
  const subject = clientCode.trim() || clientCaseLabel.trim() || "this entry";

  if (!blocked && !hasWarnings) return null;

  const taskImpact =
    context === "task-event"
      ? "Tasks and events saved under the wrong client may not appear on the matter page, calendar, or My Work."
      : "A duplicate profile can block tasks and events from appearing under the correct client matter.";

  if (codeConflict) {
    return (
      <ConflictWarningCard
        variant="blocked"
        eyebrow="Client profile"
        title="Cannot save — profile already exists"
        subtitle={
          <>
            <p>{formatCodeConflictMessage(codeConflict)}</p>
            <p className="mt-2">
              Creating <strong>{subject}</strong> would override or collide with that profile. Change the client code or
              use an existing match below. {taskImpact}
            </p>
          </>
        }
      >
        <ConflictMatchList matches={check.prefixMatches} onUseExistingCode={onUseExistingCode} />
      </ConflictWarningCard>
    );
  }

  return (
    <ConflictWarningCard
      variant="review"
      eyebrow="Conflict review"
      title="Possible conflict — review required"
      subtitle="Name, case details, or task grouping may overlap with an existing client. Review the matches and confirm how this matter should be recorded."
    >
      {profileMatches.length ? (
        <ConflictWarningSection title="May duplicate an existing profile">
          <p className="conflict-warning-card__section-copy">
            Name, case title, court, or case number looks like a client already on Master List.
          </p>
          <ConflictMatchList matches={profileMatches} onUseExistingCode={onUseExistingCode} />
        </ConflictWarningSection>
      ) : null}

      {taskGroupingMatches.length ? (
        <ConflictWarningSection title="May group tasks and events">
          {taskPrefix ? (
            <p className="conflict-warning-card__section-copy">
              <strong>{subject}</strong> maps to task prefix <strong>{taskPrefix}</strong>. Hearings and tasks can appear
              together with these clients unless you keep matters separate on purpose.
            </p>
          ) : (
            <p className="conflict-warning-card__section-copy">
              Task and event IDs group by a 3-letter prefix from the client/case name. These clients may share that
              grouping.
            </p>
          )}
          <ConflictMatchList matches={taskGroupingMatches} onUseExistingCode={onUseExistingCode} />
          <p className="conflict-warning-card__section-footnote">{taskImpact}</p>
        </ConflictWarningSection>
      ) : null}

      <ConflictReviewAcknowledgement
        choice={conflictReviewChoice}
        onChoiceChange={onConflictReviewChoiceChange}
        subject={subject}
        matches={[...profileMatches, ...taskGroupingMatches]}
        onUseExistingCode={onUseExistingCode}
      />
    </ConflictWarningCard>
  );
}
