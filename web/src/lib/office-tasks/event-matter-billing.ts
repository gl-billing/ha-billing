import { matterHasSoleAssignedLawyer } from "@/lib/assigned-lawyers";
import { parseMoney } from "@/lib/gl-config";
import { resolveClientCode } from "@/lib/office-tasks/client-matter";
import {
  appendRemarkMarkers,
  eventBillingAppearanceMarker,
  eventBillingPleadingMarker,
  hasEventBillingAppearanceMarker,
  hasEventBillingPleadingMarker
} from "@/lib/office-tasks/event-item-links";
import { isAppearanceCategory, isPleadingCategory } from "@/lib/office-tasks/event-form-utils";
import {
  buildAppearanceFeeChargeDescription,
  buildPleadingFeeChargeDescription,
  eventBillingLedgerDetails,
  suggestedEventBillingAmount
} from "@/lib/office-tasks/event-matter-billing-shared";
import { toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { addLedgerEntry } from "@/lib/sheets/ledger";
import { invalidateBillingReadCaches } from "@/lib/sheets/cache";
import { findClientForTaskCode } from "@/lib/sheets/master";
import { SHEETS } from "@/lib/tasks-config";

export {
  buildAppearanceFeeChargeDescription,
  buildPleadingFeeChargeDescription,
  eventAlreadyBilledForAppearance,
  eventAlreadyBilledForPleading,
  eventBillingLedgerDetails,
  parseAppearanceAttorneyFromLedgerDetails,
  parsePleadingDrafterFromLedgerDetails,
  parseSoleLawyerFromLedgerDetails,
  suggestedEventBillingAmount
} from "@/lib/office-tasks/event-matter-billing-shared";

async function appendEventBillingMarkers(
  accessToken: string,
  eventId: string,
  markers: string[]
): Promise<void> {
  const items = await collectAllItems(accessToken);
  const event = items.find((item) => item.source === "Event" && item.id === eventId);
  if (!event || event.rowNumber < 2) return;

  const remarks = appendRemarkMarkers(event.remarks || "", markers);
  await updateSheetValues(accessToken, toA1Range(SHEETS.events, `R${event.rowNumber}`), [[remarks]]);
}

export async function applyEventMatterBillingCharges(
  accessToken: string,
  input: {
    eventId: string;
    form: EventFormInput;
  }
): Promise<string[]> {
  const form = input.form;
  const messages: string[] = [];
  if (!form.billAppearanceFee && !form.billPleadingFee) return messages;

  const clientCase = form.clientCase.trim();
  const taskCode = resolveClientCode({ id: input.eventId, clientCase }) || "";
  const client = taskCode ? await findClientForTaskCode(accessToken, taskCode, clientCase) : null;
  if (!client?.code) {
    throw new Error("Link this event to a billing client file before adding matter charges.");
  }

  const venueText = form.venue?.trim() || client.courtPending || "";
  const defaultAmount = suggestedEventBillingAmount(venueText, client.courtPending || "");
  const amount = parseMoney(form.billingFeeAmount) || defaultAmount;
  if (!amount || amount <= 0) {
    throw new Error("Enter a valid billing fee amount.");
  }

  const chargeDate = form.eventDate || form.filingDeadline || todayYmd();
  const responsible = form.responsible.trim();
  const soleLawyerOnMatter = matterHasSoleAssignedLawyer(client.assignedAttorney, client.coAssignedAttorney);
  const markers: string[] = [];
  const existingEvent = (await collectAllItems(accessToken)).find(
    (item) => item.source === "Event" && item.id === input.eventId
  );
  const existingRemarks = existingEvent?.remarks || "";

  if (form.billAppearanceFee) {
    if (!isAppearanceCategory(form.category)) {
      throw new Error("Appearance fee billing applies to hearings, meetings, and consultations only.");
    }
    if (hasEventBillingAppearanceMarker(existingRemarks)) {
      throw new Error("An appearance fee was already billed for this event.");
    }

    const attorney = responsible || client.assignedAttorney;
    const result = await addLedgerEntry(accessToken, {
      clientCode: client.code,
      type: "Charge",
      date: chargeDate,
      category: "Appearance Fee",
      description: buildAppearanceFeeChargeDescription(form, input.eventId),
      charge: amount,
      details: eventBillingLedgerDetails({ eventId: input.eventId, attorney })
    });
    markers.push(eventBillingAppearanceMarker(input.eventId));
    messages.push(result.message);
  }

  if (form.billPleadingFee) {
    if (!isPleadingCategory(form.category)) {
      throw new Error("Drafting pleading fee billing applies to court filing events only.");
    }
    if (hasEventBillingPleadingMarker(existingRemarks)) {
      throw new Error("A drafting pleading fee was already billed for this event.");
    }

    const drafter = responsible || client.assignedAttorney;
    const result = await addLedgerEntry(accessToken, {
      clientCode: client.code,
      type: "Charge",
      date: chargeDate,
      category: "Pleading Fee",
      description: buildPleadingFeeChargeDescription(form, input.eventId),
      charge: amount,
      details: eventBillingLedgerDetails({
        eventId: input.eventId,
        drafter,
        soleLawyerOnMatter
      })
    });
    markers.push(eventBillingPleadingMarker(input.eventId));
    messages.push(result.message);
  }

  if (markers.length) {
    await appendEventBillingMarkers(accessToken, input.eventId, markers);
    invalidateBillingReadCaches(accessToken);
  }

  return messages;
}
