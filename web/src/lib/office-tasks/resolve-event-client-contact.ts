import { formatClientCaseLabel } from "@/lib/gl-config";
import { parseContactEmails } from "@/lib/contact-emails";
import { isValidEmailAddress } from "@/lib/office-tasks/gmail-send";
import { clientCaseMatchesBillingClient, parseClientCaseDisplay, resolveClientCode } from "@/lib/office-tasks/client-matter";
import { findClientForTaskCode } from "@/lib/sheets/master";
import { listWalkInClients } from "@/lib/sheets/walk-ins";

export type EventClientContact = {
  email: string;
  name: string;
  preferredGreeting?: string;
  clientCode?: string;
  source: "master" | "walkin";
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasStoredClientEmail(value: string): boolean {
  return parseContactEmails(value).some((email) => isValidEmailAddress(email));
}

export async function resolveEventClientContact(
  accessToken: string,
  clientCase: string
): Promise<EventClientContact | null> {
  const label = clientCase.trim();
  if (!label) return null;

  const taskCode = resolveClientCode({ id: "", clientCase: label }) || "";
  const caseHint = label;
  const { title } = parseClientCaseDisplay(label);

  if (taskCode) {
    const detail = await findClientForTaskCode(accessToken, taskCode, caseHint);
    if (detail?.email && hasStoredClientEmail(detail.email)) {
      return {
        email: detail.email.trim(),
        name: detail.name || title,
        preferredGreeting: detail.preferredGreeting,
        clientCode: detail.code,
        source: "master"
      };
    }
  }

  const walkIns = await listWalkInClients(accessToken);
  const normLabel = normalizeLabel(label);
  for (const entry of walkIns) {
    const walkLabel = formatClientCaseLabel(entry.name, entry.matter);
    if (normalizeLabel(walkLabel) === normLabel && entry.email && hasStoredClientEmail(entry.email)) {
      return {
        email: entry.email.trim(),
        name: entry.name,
        source: "walkin"
      };
    }
  }

  if (taskCode) {
    const detail = await findClientForTaskCode(accessToken, taskCode, caseHint);
    if (detail && clientCaseMatchesBillingClient(label, { code: detail.code, name: detail.name, caseTitle: detail.caseTitle })) {
      if (detail.email && hasStoredClientEmail(detail.email)) {
        return {
          email: detail.email.trim(),
          name: detail.name || title,
          preferredGreeting: detail.preferredGreeting,
          clientCode: detail.code,
          source: "master"
        };
      }
    }
  }

  return null;
}
