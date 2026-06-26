import { getClients } from "@/lib/sheets/master";
import { checkClientCodeForIntake } from "@/lib/sheets/client-code-check-server";
import {
  clientCodeCheckBlocksCreate,
  clientCodeCheckCanProceed,
  conflictReviewBlocksProceed,
  type ConflictReviewChoice
} from "@/lib/sheets/client-code-check";

export type IntakeConflictInput = {
  clientCode?: string;
  clientName?: string;
  caseTitle?: string;
  caseNumber?: string;
  courtPending?: string;
  conflictReviewChoice?: ConflictReviewChoice;
  /** Legacy intake flag — treated as different_case when true. */
  acknowledgeConflicts?: boolean;
};

/** Block client registration until code conflict and similarity warnings are resolved. */
export async function assertIntakeConflictClear(
  accessToken: string,
  input: IntakeConflictInput
): Promise<void> {
  const clients = await getClients(accessToken, { includeClosed: true });
  const result = await checkClientCodeForIntake(accessToken, clients, {
    clientCode: input.clientCode,
    clientName: input.clientName,
    caseTitle: input.caseTitle,
    caseNumber: input.caseNumber,
    courtPending: input.courtPending
  });

  if (clientCodeCheckBlocksCreate(result)) {
    throw new Error("That client code already exists — choose a different code before registering.");
  }

  const reviewChoice: ConflictReviewChoice | null =
    input.conflictReviewChoice || (input.acknowledgeConflicts ? "different_case" : null);

  if (!clientCodeCheckCanProceed(result, reviewChoice)) {
    throw new Error(
      conflictReviewBlocksProceed(reviewChoice) ||
        "Complete conflict review before registering this client."
    );
  }
}
