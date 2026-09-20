import { isValidEmailAddress } from "@/lib/email-utils";

export function firmWorkbookIdsToShare(): string[] {
  const ids = [
    process.env.GOOGLE_SPREADSHEET_ID?.trim(),
    process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim()
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export type ShareWorkbookResult = {
  ok: boolean;
  spreadsheetId: string;
  alreadyShared?: boolean;
  error?: string;
};

export async function shareWorkbookAsEditor(
  accessToken: string,
  spreadsheetId: string,
  email: string
): Promise<ShareWorkbookResult> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: email.trim().toLowerCase()
      })
    }
  );

  if (response.ok) {
    return { ok: true, spreadsheetId };
  }

  const detail = (await response.text()).slice(0, 240);
  if (/already|exists|unique/i.test(detail)) {
    return { ok: true, spreadsheetId, alreadyShared: true };
  }

  return { ok: false, spreadsheetId, error: detail || `Google Drive ${response.status}` };
}

export async function shareFirmWorkbooksWithStaff(
  accessToken: string,
  email: string
): Promise<{ shared: string[]; failed: string[]; warning?: string }> {
  const address = email.trim();
  if (!isValidEmailAddress(address)) {
    return { shared: [], failed: [], warning: "Staff email is not valid for spreadsheet sharing." };
  }

  const ids = firmWorkbookIdsToShare();
  if (!ids.length) {
    return { shared: [], failed: [], warning: "No firm spreadsheet IDs are configured to share." };
  }

  const shared: string[] = [];
  const failed: string[] = [];
  for (const spreadsheetId of ids) {
    const result = await shareWorkbookAsEditor(accessToken, spreadsheetId, address);
    if (result.ok) shared.push(spreadsheetId);
    else failed.push(spreadsheetId);
  }

  if (!failed.length) {
    return { shared, failed };
  }

  return {
    shared,
    failed,
    warning: `Added to the Employees sheet, but could not share ${failed.length === 1 ? "a workbook" : "workbooks"} with ${address}. Share the firm spreadsheets as Editor in Google Drive or they will see Spreadsheet access needed.`
  };
}
