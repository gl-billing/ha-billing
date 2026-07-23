import {
  clientCodeFromCase,
  parseExplicitLabelCode
} from "@/lib/office-tasks/client-matter";

export type LedgerBillingClientMatch = {
  /** Hard match — safe to post without prompting. */
  aligned: boolean;
  /** Soft mismatch — show confirm before posting. */
  needsConfirmation: boolean;
  expectedCode: string | null;
  ledgerCode: string;
  message: string | null;
};

export function assessLedgerBillingClientMatch(input: {
  clientCase: string;
  ledgerClientCode: string;
  /** Master List code from the case picker, when available. */
  pickerClientCode?: string;
}): LedgerBillingClientMatch {
  const ledger = input.ledgerClientCode.trim().toUpperCase();
  const caseLabel = input.clientCase.trim();
  const picker = input.pickerClientCode?.trim().toUpperCase() || "";

  const base = { ledgerCode: ledger, expectedCode: picker || null };

  if (!ledger) {
    return {
      ...base,
      aligned: false,
      needsConfirmation: false,
      message: "Select a billing client file before posting a charge or payment."
    };
  }

  if (!caseLabel) {
    return {
      ...base,
      aligned: false,
      needsConfirmation: false,
      message: "Select or enter the client / case before billing."
    };
  }

  if (picker && picker !== ledger) {
    return {
      ...base,
      aligned: false,
      needsConfirmation: true,
      expectedCode: picker,
      message: `This ${itemWord(caseLabel)} is on billing file ${picker}, but the ledger entry would post to ${ledger}.`
    };
  }

  const explicit = parseExplicitLabelCode(caseLabel);
  if (explicit) {
    if (explicit === ledger) {
      return { ...base, aligned: true, needsConfirmation: false, expectedCode: explicit, message: null };
    }
    return {
      ...base,
      aligned: false,
      needsConfirmation: true,
      expectedCode: explicit,
      message: `The label starts with billing file ${explicit}, but the charge would post to ${ledger}.`
    };
  }

  const prefix = clientCodeFromCase(caseLabel).toUpperCase();
  if (ledger === prefix) {
    return { ...base, aligned: true, needsConfirmation: false, expectedCode: ledger, message: null };
  }

  if (ledger.length > 3 && prefix.length === 3 && ledger.slice(0, 3) === prefix) {
    return {
      ...base,
      aligned: true,
      needsConfirmation: true,
      expectedCode: prefix,
      message: `Billing file ${ledger} is a specific matter under task prefix ${prefix}. Confirm this is the correct client ledger.`
    };
  }

  if (prefix.length === 3 && ledger.slice(0, 3) === prefix) {
    return { ...base, aligned: true, needsConfirmation: false, expectedCode: ledger, message: null };
  }

  return {
    ...base,
    aligned: false,
    needsConfirmation: true,
    expectedCode: prefix || null,
    message: `The case label does not clearly match billing file ${ledger}. Confirm the charge belongs on that client's ledger.`
  };
}

function itemWord(caseLabel: string): string {
  return /event|hearing|filing|deadline/i.test(caseLabel) ? "event" : "matter";
}

export function formatLedgerBillingMismatchPrompt(match: LedgerBillingClientMatch): string {
  const lines = [
    match.message || "The billing client file may not match this task or event.",
    "",
    `Ledger file: ${match.ledgerCode}`,
    match.expectedCode ? `Expected from case: ${match.expectedCode}` : "",
    "",
    "Post this charge or payment on that ledger anyway?"
  ].filter(Boolean);
  return lines.join("\n");
}

/** Server-side guard before writing a ledger row. */
export function validateLedgerBillingClientAlignment(input: {
  clientCase: string;
  ledgerClientCode: string;
  confirmed?: boolean;
}): string | null {
  const match = assessLedgerBillingClientMatch({
    clientCase: input.clientCase,
    ledgerClientCode: input.ledgerClientCode
  });

  if (match.aligned && !match.needsConfirmation) return null;

  if (match.needsConfirmation && input.confirmed) return null;

  if (!match.aligned && !match.needsConfirmation) {
    return match.message || "Billing client file is missing or invalid.";
  }

  return (
    match.message ||
    `Billing file ${match.ledgerCode} may not match this case. Re-open the form and confirm the client ledger.`
  );
}
