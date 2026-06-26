/** Rows saved while the sheet table started in column W/X land offset — realign reads to column A. */

export function findSourceIdColumnOffset(
  row: unknown[],
  isValidId: (id: string) => boolean,
  headerCount: number
): number {
  const first = String(row[0] || "").trim();
  if (isValidId(first)) return 0;

  const limit = Math.min(row.length, headerCount + 30);
  for (let index = 1; index < limit; index++) {
    const value = String(row[index] || "").trim();
    if (isValidId(value)) return index;
  }
  return 0;
}

export function alignRowToColumnA(
  row: unknown[],
  offset: number,
  headerCount: number
): unknown[] {
  const aligned = row.slice(offset, offset + headerCount);
  while (aligned.length < headerCount) aligned.push("");
  return aligned;
}

export function collectSourceIdsFromRows(
  rows: unknown[][],
  isValidId: (id: string) => boolean,
  headerCount: number
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    const offset = findSourceIdColumnOffset(row, isValidId, headerCount);
    const candidate = String(row[offset] || "").trim();
    if (isValidId(candidate)) {
      ids.push(candidate);
      continue;
    }
    for (const cell of row) {
      const text = String(cell || "").trim();
      if (isValidId(text)) {
        ids.push(text);
        break;
      }
    }
  }
  return ids;
}
