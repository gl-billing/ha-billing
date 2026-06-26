import { getSheetsClient, getSpreadsheetId } from "@/lib/sheets/client";

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function extractHyperlinkFromFormula(formula: string): string {
  const match = formula.match(/^=HYPERLINK\s*\(\s*"((?:[^"\\]|\\.)*)"/i);
  return match?.[1]?.replace(/\\"/g, '"') || "";
}

/** Resolve a PDF link from cell display text, hyperlink metadata, or HYPERLINK formula. */
export function resolvePdfUrl(
  rawValue: unknown,
  hyperlink?: string,
  formula?: string
): string {
  const uri = String(hyperlink || "").trim();
  if (isHttpUrl(uri)) return uri;

  const raw = String(rawValue || "").trim();
  if (isHttpUrl(raw)) return raw;

  const fromFormula = formula ? extractHyperlinkFromFormula(formula) : "";
  if (isHttpUrl(fromFormula)) return fromFormula;

  return "";
}

/** Map 1-based sheet row number → hyperlink URI for the first column in `range`. */
export async function getHyperlinksByRow(
  accessToken: string,
  range: string,
  startRow: number
): Promise<Map<number, string>> {
  const sheets = getSheetsClient(accessToken);
  const response = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    ranges: [range],
    fields: "sheets.data.rowData.values.hyperlink,sheets.data.rowData.values.userEnteredValue"
  });

  const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const map = new Map<number, string>();

  rowData.forEach((row, index) => {
    const cell = row.values?.[0];
    const formula = cell?.userEnteredValue?.formulaValue || "";
    const uri = resolvePdfUrl("", cell?.hyperlink ?? undefined, formula);
    if (uri) {
      map.set(startRow + index, uri);
    }
  });

  return map;
}
