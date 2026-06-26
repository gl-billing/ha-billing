"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clientCodeCheckBlocksCreate,
  clientCodeCheckCanProceed,
  clientCodeCheckHasWarnings,
  collisionWarningMessage,
  type ClientCodeCheckResult,
  type ConflictReviewChoice
} from "@/lib/sheets/client-code-check";

type Input = {
  clientCode?: string;
  clientName?: string;
  caseTitle?: string;
  caseNumber?: string;
  courtPending?: string;
  /** Manual client/case label from +task / +event picker */
  clientCaseLabel?: string;
};

export function useClientCodeCheck(input: Input) {
  const [check, setCheck] = useState<ClientCodeCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflictReviewChoice, setConflictReviewChoice] = useState<ConflictReviewChoice | null>(null);

  const runCheck = useCallback(async (): Promise<ClientCodeCheckResult | null> => {
    const clientCase = input.clientCaseLabel?.trim() || "";
    const code = input.clientCode?.trim() || "";
    const name = input.clientName?.trim() || "";
    const caseTitle = input.caseTitle?.trim() || "";
    if (!clientCase && !code && !name && !caseTitle) {
      setCheck(null);
      setConflictReviewChoice(null);
      return null;
    }

    setChecking(true);
    try {
      const params = new URLSearchParams();
      if (clientCase) {
        params.set("clientCase", clientCase);
      } else {
        params.set("code", input.clientCode || "");
        params.set("name", input.clientName || "");
        params.set("caseTitle", input.caseTitle || "");
        params.set("caseNumber", input.caseNumber || "");
        params.set("court", input.courtPending || "");
      }
      const res = await fetch(`/api/clients/code-check?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setCheck(null);
        return null;
      }
      const result = json as ClientCodeCheckResult;
      setCheck(result);
      setConflictReviewChoice(null);
      return result;
    } finally {
      setChecking(false);
    }
  }, [
    input.caseNumber,
    input.caseTitle,
    input.clientCaseLabel,
    input.clientCode,
    input.clientName,
    input.courtPending
  ]);

  useEffect(() => {
    setConflictReviewChoice(null);
  }, [input.clientCode, input.clientCaseLabel, input.clientName, input.caseTitle]);

  const codeBlocked = clientCodeCheckBlocksCreate(check);
  const hasWarnings = clientCodeCheckHasWarnings(check);
  const canProceed = clientCodeCheckCanProceed(check, conflictReviewChoice);
  const warningMessage = collisionWarningMessage(check);

  return {
    check,
    checking,
    runCheck,
    conflictReviewChoice,
    setConflictReviewChoice,
    /** @deprecated use conflictReviewChoice === "different_case" */
    ackWarning: conflictReviewChoice === "different_case",
    setAckWarning: (value: boolean) => setConflictReviewChoice(value ? "different_case" : null),
    codeBlocked,
    hasWarnings,
    canProceed,
    warningMessage
  };
}
