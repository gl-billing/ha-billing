import { getSheetsClient, getSpreadsheetId } from "@/lib/sheets/client";
import { invalidateCache, withCache } from "@/lib/sheets/cache";

export async function getSheetTitles(accessToken: string): Promise<Set<string>> {
  const titles = await withCache(accessToken, "sheet-titles", 5 * 60_000, async () => {
    const sheets = getSheetsClient(accessToken);
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: "sheets.properties.title"
    });
    return (meta.data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t);
  });
  return new Set(titles);
}

export async function sheetTitleExists(accessToken: string, title: string): Promise<boolean> {
  const titles = await getSheetTitles(accessToken);
  return titles.has(title);
}

export async function getSheetIdByTitle(
  accessToken: string,
  title: string
): Promise<number | null> {
  const sheets = getSheetsClient(accessToken);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties"
  });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const id = sheet?.properties?.sheetId;
  return id === undefined || id === null ? null : id;
}

/** Create a worksheet tab when missing (required before values.append on that tab). */
export async function ensureSheetTitle(accessToken: string, title: string): Promise<void> {
  if (await sheetTitleExists(accessToken, title)) return;

  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }]
    }
  });
  invalidateCache(accessToken, "sheet-titles");
}

export async function deleteSheetById(accessToken: string, sheetId: number): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [{ deleteSheet: { sheetId } }]
    }
  });
  invalidateCache(accessToken, "sheet-titles");
}
