export type SheetsAccessHint = {
  title: string;
  body: string;
  showReload?: boolean;
  showSignIn?: boolean;
};

export function formatSheetsAccessHint(message: string, email?: string | null): SheetsAccessHint | null {
  const text = message.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const signInEmail = email?.trim() || "your sign-in email";

  // Role gates (associate lawyers / tasks-only) — not a Google Sheets sharing problem.
  if (/do not have access to the billing system|billing system access|tasks only/i.test(lower)) {
    return {
      title: "Billing access not enabled for this account",
      body: `Associate lawyers and tasks-only staff use Office Tasks, not the billing ledger. Signed in as ${signInEmail}. Ask an admin if this account should have billing access.`,
      showReload: false,
      showSignIn: false
    };
  }

  if (
    /caller does not have permission|permission denied|insufficient permission|the caller does not have permission|forbidden|spreadsheet.*(access|permission)|google sheets.*(access|permission|403)/i.test(
      lower
    )
  ) {
    return {
      title: "Spreadsheet access needed",
      body: `Ask your office administrator to share the firm workbooks with ${signInEmail} (the Google account used to sign in). Then sign out, sign in again, and select Update.`,
      showReload: true,
      showSignIn: true
    };
  }

  if (/quota|rate limit|429|too many requests|read limit/i.test(lower)) {
    return {
      title: "Google Sheets is busy",
      body: "The read limit was reached. Wait about 60 seconds, then select Update once — avoid repeating Update repeatedly.",
      showReload: true
    };
  }

  if (/session expired|unauthorized|sign in again|invalid_grant|token/i.test(lower)) {
    return {
      title: "Sign-in expired",
      body: "Your Google session may have expired. Sign out and sign in again, then update this page.",
      showReload: true,
      showSignIn: true
    };
  }

  if (/unable to parse range|spreadsheet|workbook|sheet tab/i.test(lower)) {
    return {
      title: "Spreadsheet setup issue",
      body: `${text} If this persists, check Office Hub → Instructions or ask an admin to verify spreadsheet IDs and tab names.`,
      showReload: true
    };
  }

  return null;
}
