import { clientCodeFromCase, clientNameTokensInLabel } from "@/lib/office-tasks/client-matter";
import { formatClientCaseLabel } from "@/lib/gl-config";
import { isRegisteredFirmMatterItem } from "@/lib/office-tasks/firm-matters";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getClients } from "@/lib/sheets/master";

export type OrphanTaskItem = OfficeItem & {
  reason: string;
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Open tasks/events whose client/case no longer matches any Master List client. */
export async function findOrphanTaskItems(accessToken: string, items: OfficeItem[]): Promise<OrphanTaskItem[]> {
  const clients = await getClients(accessToken, { includeClosed: true });
  const codes = new Set<string>();

  for (const client of clients) {
    codes.add(client.code.trim().toUpperCase());
    codes.add(clientCodeFromCase(client.name || client.code));
  }

  const orphans: OrphanTaskItem[] = [];

  for (const item of items) {
    if (item.done) continue;
    if (isRegisteredFirmMatterItem(item)) continue;

    const caseLabel = item.clientCase?.trim();
    if (!caseLabel) {
      orphans.push({ ...item, reason: "Missing client / case name" });
      continue;
    }

    const prefix = clientCodeFromCase(caseLabel);
    const normalized = normalizeLabel(caseLabel);
    const idPrefix = item.id?.match(/^([A-Z]{2,3})-(TASK|EVT)-/)?.[1] || "";

    const matchesCode =
      codes.has(prefix) ||
      codes.has(idPrefix) ||
      [...codes].some((code) => caseLabel.toUpperCase().startsWith(code));

    const matchesLabel = clients.some((client) => {
      if (!client.name?.trim()) return false;
      if (clientNameTokensInLabel(client.name, caseLabel)) return true;
      const canonical = formatClientCaseLabel(client.name, client.caseTitle || "");
      return normalized === normalizeLabel(canonical);
    });

    if (!matchesCode && !matchesLabel) {
      orphans.push({
        ...item,
        reason: `No Master List client matches “${caseLabel}” (${prefix || idPrefix || "?"})`
      });
    }
  }

  return orphans.sort(
    (a, b) => a.clientCase.localeCompare(b.clientCase) || a.id.localeCompare(b.id)
  );
}
