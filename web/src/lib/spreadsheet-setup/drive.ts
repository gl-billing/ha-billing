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
  name: string,
  options?: { sourceLabel?: string }
): Promise<string> {
  const sourceLabel = options?.sourceLabel?.trim() || "spreadsheet";
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
        `Could not copy ${sourceLabel} (${sourceId}) — not found or not accessible via Drive for your HA Google account. ` +
          "Drive copy needs the spreadsheets + drive OAuth scopes on CRON_GOOGLE_REFRESH_TOKEN and the file shared with that account. " +
          "If you can edit the sheet in place, run scrub without --copy-first. " +
          "Otherwise use File → Make a copy in Google Sheets (see docs/CLEAN-SHEET-SETUP.md Option B)."
      );
    }
    throw new Error(`Could not copy ${sourceLabel} (${response.status}): ${detail}`);
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
