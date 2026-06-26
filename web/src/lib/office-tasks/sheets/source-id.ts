/** Matches Apps Script getClientPrefix_ + generateSourceId_ (LAW OFFICE TASK + CALENDAR V2). */

export function getClientPrefix(clientCase: string): string {
  const clean = String(clientCase || "GEN")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return clean.substring(0, 3) || "GEN";
}

export function generateSourceId(
  existingIds: Iterable<string>,
  clientCase: string,
  label: "TASK" | "EVT"
): string {
  const prefix = `${getClientPrefix(clientCase)}-${label}-`;
  let highest = 0;
  const suffixRe = new RegExp(`${label}-(\\d+)$`);

  for (const raw of existingIds) {
    const currentId = String(raw || "").trim();
    if (!currentId.startsWith(prefix)) continue;
    const match = currentId.match(suffixRe);
    if (!match) continue;
    const n = Number(match[1]);
    if (n > highest) highest = n;
  }

  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
