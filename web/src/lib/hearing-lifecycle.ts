import { EVENT_LEDGER_CHARGE_MARKER, findEventLedgerCharge } from "@/lib/event-ledger-charge";
import type { LedgerEntry } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { AppearanceFeeOption } from "@/lib/sheets/ledger-read";
import {
  isCourtConfirmed,
  isHearingItem,
  isHearingPendingCourtConfirmation
} from "@/lib/hearing-escalation";
import { HEARING_PREP_ITEMS } from "@/lib/office-tasks/event-form-utils";
import { isItemOpen } from "@/lib/office-tasks/schedule";

export type HearingLifecycleState = {
  item: OfficeItem;
  needsCourtConfirmation: boolean;
  courtConfirmed: boolean;
  prepItems: readonly string[];
  linkedAppearanceFee?: AppearanceFeeOption;
};

export function linkAppearanceFeeForHearing(
  item: OfficeItem,
  appearanceFees: AppearanceFeeOption[],
  ledgerEntries: Array<Pick<LedgerEntry, "sheetRow" | "date" | "charge" | "category" | "description" | "type">> = []
): AppearanceFeeOption | undefined {
  const fromLedger = findEventLedgerCharge(item.id, ledgerEntries);
  if (fromLedger) {
    return {
      sheetRow: fromLedger.sheetRow,
      date: fromLedger.date,
      amount: fromLedger.amount,
      category: fromLedger.category,
      description: fromLedger.description,
      display: ""
    };
  }

  const eventMarker = `${EVENT_LEDGER_CHARGE_MARKER}:${item.id}`.toLowerCase();
  const byEventMarker = appearanceFees.find((fee) =>
    fee.description.toLowerCase().includes(eventMarker)
  );
  if (byEventMarker) return byEventMarker;

  const draft = suggestedAppearanceCharge(item).description.toLowerCase();
  return appearanceFees.find((fee) => {
    const description = fee.description.toLowerCase();
    return description.includes(draft.slice(0, 48)) || draft.includes(description.slice(0, 48));
  });
}

export function buildHearingLifecycleStates(
  events: OfficeItem[],
  appearanceFees: AppearanceFeeOption[] = [],
  ledgerEntries: Array<Pick<LedgerEntry, "sheetRow" | "date" | "charge" | "category" | "description" | "type">> = []
): HearingLifecycleState[] {
  return events
    .filter(isHearingItem)
    .filter(isItemOpen)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .map((item) => {
      const linkedAppearanceFee = linkAppearanceFeeForHearing(item, appearanceFees, ledgerEntries);
      return {
        item,
        needsCourtConfirmation: isHearingPendingCourtConfirmation(item),
        courtConfirmed: isCourtConfirmed(item.remarks),
        prepItems: HEARING_PREP_ITEMS,
        linkedAppearanceFee
      };
    });
}

export function suggestedAppearanceCharge(item: OfficeItem): {
  category: "Appearance Fee";
  description: string;
} {
  const venue = item.venue?.trim();
  const date = item.date || item.eventDate || "";
  return {
    category: "Appearance Fee",
    description: `Appearance fee — ${item.details.trim() || "Hearing"}${venue ? ` · ${venue}` : ""}${date ? ` · ${date}` : ""}`
  };
}

export function hearingLifecycleOpenCount(states: HearingLifecycleState[]): number {
  return states.filter((state) => state.needsCourtConfirmation).length;
}
