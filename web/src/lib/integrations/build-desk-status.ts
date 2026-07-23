import "server-only";

import { accessTokenHasGmailSend } from "@/lib/office-tasks/gmail-send";
import { readSettingsMap } from "@/lib/sheets/settings";
import {
  type DeskConnectorMap,
  type DeskConnectorStatus
} from "@/lib/integrations/desk-connectors";

const GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";
const CALENDAR = "https://www.googleapis.com/auth/calendar";
const SPREADSHEETS = "https://www.googleapis.com/auth/spreadsheets";
const DRIVE = "https://www.googleapis.com/auth/drive";

async function googleTokenScopes(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { scope?: string; error?: string };
    if (data.error) return [];
    return String(data.scope || "")
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function statusFromFlags(ok: boolean, configured: boolean, hardError = false): DeskConnectorStatus {
  if (hardError) return "error";
  if (ok) return "ok";
  if (!configured) return "warn";
  return "warn";
}

export type BuildDeskConnectorsOptions = {
  accessToken: string;
  sessionEmail?: string | null;
  settingsHref: string;
  calendarHref: string;
  reportsHref: string;
  loginHref?: string;
};

export async function buildDeskConnectors(
  options: BuildDeskConnectorsOptions
): Promise<DeskConnectorMap> {
  const {
    accessToken,
    sessionEmail,
    settingsHref,
    calendarHref,
    reportsHref,
    loginHref = "/login?switch=1"
  } = options;

  const scopes = await googleTokenScopes(accessToken);
  const hasGmail = scopes.includes(GMAIL_SEND) || (await accessTokenHasGmailSend(accessToken));
  const hasCalendar = scopes.includes(CALENDAR);
  const hasSheets = scopes.includes(SPREADSHEETS);
  const hasDrive = scopes.includes(DRIVE);

  const billingSheet = Boolean(process.env.GOOGLE_SPREADSHEET_ID?.trim());
  const tasksSheet = Boolean(
    process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim() || process.env.GOOGLE_SPREADSHEET_ID?.trim()
  );

  let senderEmail = "";
  let driveFolderLink = "";
  try {
    const settings = await readSettingsMap(accessToken);
    senderEmail =
      settings.get("Sender Email")?.trim() || settings.get("Billing From Email")?.trim() || "";
    driveFolderLink =
      settings.get("Client Documents Drive Folder")?.trim() ||
      settings.get("Drive Folder Link")?.trim() ||
      "";
  } catch {
    /* settings optional for status */
  }

  const googleOk = hasGmail && hasCalendar;
  const googleConfigured = hasGmail || hasCalendar;
  const missingGoogle: string[] = [];
  if (!hasGmail) missingGoogle.push("Gmail send");
  if (!hasCalendar) missingGoogle.push("Calendar");
  let googleMessage = googleOk
    ? "Signed-in Google account can send mail and sync calendar."
    : googleConfigured
      ? `Missing permission: ${missingGoogle.join(", ")}. Sign out and sign in again to approve Google access.`
      : "Sign in with Google and approve Gmail + Calendar when prompted.";
  if (googleOk && senderEmail && sessionEmail) {
    const sender = senderEmail.toLowerCase();
    const session = sessionEmail.toLowerCase();
    if (sender && session && sender !== session) {
      googleMessage += ` Firm sender is ${senderEmail}; you are signed in as ${sessionEmail}.`;
    }
  }

  const sheetsOk = billingSheet && tasksSheet && hasSheets;
  const sheetsConfigured = billingSheet || tasksSheet;
  const sheetsMessage = sheetsOk
    ? "Billing and tasks workbooks are configured for this workspace."
    : !billingSheet
      ? "Billing spreadsheet is not configured yet."
      : !hasSheets
        ? "Google Sheets permission is missing on your sign-in. Sign out and sign in again."
        : "Tasks spreadsheet is not set — tasks may write to the billing workbook.";

  const storageConfigured = Boolean(driveFolderLink);
  const storageOk = storageConfigured && hasDrive;
  const storageMessage = storageOk
    ? "Client PDFs save to the firm Google Drive folder."
    : driveFolderLink
      ? "Drive folder is set, but Drive permission is missing on your sign-in."
      : "Set the firm Drive folder in Settings when you want automatic document copies.";

  return {
    google: {
      id: "google",
      label: "Google (Calendar & Gmail)",
      description: "Hearings, Meet links, SOA and digest email from the signed-in account.",
      status: statusFromFlags(googleOk, googleConfigured),
      configured: googleConfigured,
      ok: googleOk,
      message: googleMessage,
      canTest: false,
      canReconnect: !googleOk,
      reconnectHref: loginHref,
      settingsHref,
      openHref: calendarHref,
      openLabel: "Open calendar"
    },
    sheets: {
      id: "sheets",
      label: "Google Sheets",
      description: "Billing ledger and office tasks workbooks.",
      status: statusFromFlags(sheetsOk, sheetsConfigured),
      configured: sheetsConfigured,
      ok: sheetsOk,
      message: sheetsMessage,
      canTest: false,
      settingsHref,
      openHref: reportsHref,
      openLabel: "Reports"
    },
    storage: {
      id: "storage",
      label: "Document storage",
      description: "Firm Drive folder for client PDFs and matter documents.",
      status: statusFromFlags(storageOk, storageConfigured),
      configured: storageConfigured,
      ok: storageOk,
      message: storageMessage,
      detail: driveFolderLink || undefined,
      canTest: false,
      settingsHref
    }
  };
}
