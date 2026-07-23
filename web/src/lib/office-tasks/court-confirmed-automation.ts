import "server-only";

import { pushItemToCalendar } from "@/lib/calendar/sync";
import { findEventLedgerCharge } from "@/lib/event-ledger-charge";
import {
  buildEventLedgerChargeDescription,
  defaultEventLedgerChargeAmount,
  resolveEventLedgerChargeCategory
} from "@/lib/event-ledger-charge";
import { resolveEventLedgerBillingCode } from "@/lib/event-ledger-charge-server";
import { readFirmAutomationSettings } from "@/lib/firm-automation-settings";
import { buildAppearanceFeePostedNotice, formatPostedLedgerChargeNotice } from "@/lib/ledger-charge-notices";
import { isCourtConfirmed, markCourtConfirmed } from "@/lib/hearing-escalation";
import { splitEventCategory } from "@/lib/office-tasks/event-form-utils";
import { sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { parsePrepChecklistState, prepChecklistProgress } from "@/lib/office-tasks/prep-checklist-storage";
import { resolveEventClientContact } from "@/lib/office-tasks/resolve-event-client-contact";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import { getSheetValues, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { todayYmd } from "@/lib/office-tasks/schedule";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { addLedgerEntry } from "@/lib/sheets/ledger";
import { SHEETS } from "@/lib/tasks-config";
import { EVENT_LEDGER_CHARGE_MARKER } from "@/lib/event-ledger-charge";

function hearingPrepComplete(remarks: string): boolean {
  const state = parsePrepChecklistState(remarks);
  if (!state) return true;
  const { done, total } = prepChecklistProgress(state);
  return total === 0 || done >= total;
}

export async function runCourtConfirmedAutomations(
  accessToken: string,
  event: OfficeItem & { rowNumber: number },
  actor: string
): Promise<{ messages: string[] }> {
  if (event.source !== "Event" || event.rowNumber < 2) return { messages: [] };
  const rowNumber = event.rowNumber;

  const settings = await readFirmAutomationSettings(accessToken);
  const messages: string[] = [];

  const remarksRange = toA1Range(SHEETS.events, `R${rowNumber}`);
  const rows = await getSheetValues(accessToken, remarksRange);
  const currentRemarks = String(rows[0]?.[0] ?? "");
  if (!isCourtConfirmed(currentRemarks)) {
    await updateSheetValues(accessToken, remarksRange, [[markCourtConfirmed(currentRemarks)]]);
  }

  const hearingDate = (event.eventDate || event.date || "").trim();
  const venue = event.venue?.trim() || "Court";
  const time = event.startTime?.trim();

  if (settings.proactiveClientEventNotices) {
    const contact = await resolveEventClientContact(accessToken, event.clientCase);
    if (contact?.email) {
      const subject = `Hearing confirmed — ${hearingDate || "date TBD"}`;
      const body =
        `Hearing confirmed: ${hearingDate || "date TBD"} · ${venue}` +
        (time ? ` · ${time}` : "") +
        `\n\nMatter: ${event.clientCase}`;
      try {
        await sendClientEmailViaGmail({
          accessToken,
          to: contact.email,
          subject,
          plain: body,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>`
        });
        messages.push("Client confirmation email sent.");
      } catch {
        messages.push("Could not send client confirmation email.");
      }
    }
  }

  if (event.calendarEventId && event.calendarSync) {
    try {
      await pushItemToCalendar(accessToken, {
        ...event,
        category: event.category.startsWith("CONFIRMED") ? event.category : `CONFIRMED — ${event.category}`
      });
      messages.push("Calendar event updated with CONFIRMED title.");
    } catch {
      messages.push("Court confirmed saved; calendar update failed.");
    }
  }

  const billing = await resolveEventLedgerBillingCode(accessToken, {
    ledgerClientCode: "",
    clientCase: event.clientCase
  });
  let ledgerEntries: import("@/lib/gl-config").LedgerEntry[] = [];
  if (billing.code) {
    try {
      ledgerEntries = (await getClientLedger(accessToken, billing.code)).entries;
    } catch {
      ledgerEntries = [];
    }
  }

  if (
    settings.autoPostAppearanceOnCourtConfirm &&
    hearingPrepComplete(event.remarks || "") &&
    !findEventLedgerCharge(event.id, ledgerEntries)
  ) {
    if (billing.code) {
      const split = splitEventCategory(event.category);
      const amount = defaultEventLedgerChargeAmount({
        category: split.category,
        categoryOther: split.categoryOther,
        venue: event.venue,
        courtPending: billing.courtPending
      });
      if (amount > 0) {
        const chargeDate = hearingDate || todayYmd();
        const form = {
          category: split.category,
          categoryOther: split.categoryOther,
          details: event.details,
          venue: event.venue,
          eventDate: event.eventDate || event.date || "",
          filingDeadline: event.filingDeadline || ""
        } as EventFormInput;
        await addLedgerEntry(accessToken, {
          clientCode: billing.code,
          type: "Charge",
          date: chargeDate,
          category: resolveEventLedgerChargeCategory(split.category, split.categoryOther),
          description: buildEventLedgerChargeDescription(form, event.id),
          charge: amount
        });
        const notice = buildAppearanceFeePostedNotice({
          clientCode: billing.code,
          clientCase: event.clientCase,
          amount,
          postedDate: chargeDate,
          hearingDate: hearingDate || undefined,
          hearingLabel: event.details
        });
        messages.push(`Appearance fee posted — ${formatPostedLedgerChargeNotice(notice)}`);
        await appendTaskActivity(accessToken, {
          user: actor,
          action: "ledger",
          source: "Event",
          itemId: event.id,
          clientCase: event.clientCase,
          summary: "Appearance fee auto-posted on court confirm",
          details: `${EVENT_LEDGER_CHARGE_MARKER}:${event.id}`
        });
      }
    }
  }

  return { messages };
}
