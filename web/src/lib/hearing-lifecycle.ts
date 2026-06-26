import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { AppearanceFeeOption } from "@/lib/sheets/ledger-read";
import {
  isCourtConfirmed,
  isHearingItem,
  isHearingPendingCourtConfirmation
} from "@/lib/hearing-escalation";
import { HEARING_PREP_ITEMS } from "@/lib/office-tasks/event-form-utils";

export type HearingLifecycleState = {
  item: OfficeItem;
  needsCourtConfirmation: boolean;
  courtConfirmed: boolean;
  prepItems: readonly string[];
  linkedAppearanceFee?: AppearanceFeeOption;
};

export function buildHearingLifecycleStates(
  events: OfficeItem[],
  appearanceFees: AppearanceFeeOption[] = []
): HearingLifecycleState[] {
  return events
    .filter(isHearingItem)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .map((item) => {
      const linkedAppearanceFee = appearanceFees.find((fee) =>
        item.details.toLowerCase().includes(fee.description.toLowerCase().slice(0, 12))
      );
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
