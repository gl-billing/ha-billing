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

  if (
    /caller does not have permission|permission denied|insufficient permission|403|does not have access|forbidden/i.test(
      lower
    )
  ) {
    return {
      title: "Spreadsheet access needed",
      body: `Share the Office Tasks and Billing workbooks with ${signInEmail}, then sign out and sign in again. If you just shared, wait about one minute and tap Reload.`,
      showReload: true,
      showSignIn: true
    };
  }

  if (/quota|rate limit|429|too many requests|read limit/i.test(lower)) {
    return {
      title: "Google Sheets is busy",
      body: "The read limit was reached. Wait about 60 seconds, then tap Reload once — avoid clicking Reload repeatedly.",
      showReload: true
    };
  }

  if (/session expired|unauthorized|sign in again|invalid_grant|token/i.test(lower)) {
    return {
      title: "Sign-in expired",
      body: "Your Google session may have expired. Sign out and sign in again, then reload this page.",
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
