type DriveFetchInit = RequestInit & { accessToken: string };

async function driveFetch(url: string, init: DriveFetchInit): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(headers || {})
    },
    cache: "no-store"
  });
}

export async function copyDriveFile(
  accessToken: string,
  sourceId: string,
  name: string
): Promise<string> {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sourceId)}/copy?supportsAllDrives=true&fields=id`,
    {
      accessToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    if (response.status === 404) {
      throw new Error(
        `Template spreadsheet not found or not shared with your HA Google account (${sourceId}). ` +
          "Open the template in Drive while signed in as the HA cron account, use File → Make a copy, " +
          "then set GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID / GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID to your copy's ID. " +
          "Or use Option B in docs/CLEAN-SHEET-SETUP.md (manual copy)."
      );
    }
    throw new Error(`Could not copy template spreadsheet (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Spreadsheet copy succeeded but no file id was returned.");
  }
  return payload.id;
}

export function spreadsheetEditUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
