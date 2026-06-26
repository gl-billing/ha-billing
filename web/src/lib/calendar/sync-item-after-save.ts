import { pushItemToCalendar } from "@/lib/calendar/sync";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";

export async function syncSavedItemToCalendar(
  accessToken: string,
  itemId: string,
  calendarSync: boolean
): Promise<{ calendarEventId?: string; calendarError?: string }> {
  if (!calendarSync || !itemId.trim()) return {};

  const items = await collectAllItems(accessToken);
  const item = items.find((row) => row.id === itemId.trim());
  if (!item) return { calendarError: "Saved item not found for calendar sync." };
  if (!item.date) return { calendarError: "Item has no date for calendar sync." };

  try {
    const calendarEventId = await pushItemToCalendar(accessToken, item);
    return { calendarEventId };
  } catch (error) {
    return {
      calendarError: error instanceof Error ? error.message : "Calendar sync failed."
    };
  }
}
