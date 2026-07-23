import "server-only";

import { findEventLedgerCharge } from "@/lib/event-ledger-charge";
import { readFirmAutomationSettings } from "@/lib/firm-automation-settings";
import { formatPeso } from "@/lib/gl-config";
import { isHearingItem } from "@/lib/hearing-escalation";
import { splitEventCategory } from "@/lib/office-tasks/event-form-utils";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { resolveEventClientContact } from "@/lib/office-tasks/resolve-event-client-contact";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { resolveEventLedgerBillingCode } from "@/lib/event-ledger-charge-server";

export async function sendClientEventClosedNotice(
  accessToken: string,
  item: OfficeItem,
  mode: "filed" | "appeared"
): Promise<string | null> {
  const settings = await readFirmAutomationSettings(accessToken);
  if (!settings.proactiveClientEventNotices) return null;

  const contact = await resolveEventClientContact(accessToken, item.clientCase);
  if (!contact?.email) return null;

  const date = item.filingDate || item.eventDate || item.date || "";
  const venue = item.venue?.trim();
  let feeLine = "";
  const billing = await resolveEventLedgerBillingCode(accessToken, {
    ledgerClientCode: "",
    clientCase: item.clientCase
  });
  if (billing.code) {
    try {
      const { entries } = await getClientLedger(accessToken, billing.code);
      const charge = findEventLedgerCharge(item.id, entries);
      if (charge?.charge) feeLine = ` Amount recorded: ${formatPeso(charge.charge)}.`;
    } catch {
      /* optional */
    }
  }

  const split = splitEventCategory(item.category);
  const isHearing = isHearingItem(item) || mode === "appeared";
  const subject = isHearing
    ? `We appeared for your hearing — ${date || "your matter"}`
    : `Filing submitted — ${split.category || "your matter"}`;
  const plain = isHearing
    ? `We appeared for your matter on ${date || "the scheduled date"}${venue ? ` at ${venue}` : ""}.${feeLine}\n\n${item.clientCase}`
    : `We filed/submitted ${item.details.trim().slice(0, 120) || "documents"} on ${date || "the scheduled date"}.${feeLine}\n\n${item.clientCase}`;

  await sendClientEmailViaGmail({
    accessToken,
    to: contact.email,
    subject,
    plain,
    html: `<p>${plain.replace(/\n/g, "<br>")}</p>`
  });

  return `Client notice sent (${contact.email}).`;
}
