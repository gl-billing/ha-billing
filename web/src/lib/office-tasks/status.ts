/** Task/event status actions — client-safe (no Google Sheets imports). */

export type ItemStatusUpdate =
  | "Cancelled"
  | "Reset"
  | "restore"
  | "Started"
  | "Waiting"
  | "In Progress";

export type ItemStatusOptions = {
  /** Optional note saved to Remarks when marking Started or Waiting. */
  note?: string;
};

export function resolveStatusLabel(
  source: "Task" | "Event",
  statusUpdate: ItemStatusUpdate
): string {
  if (statusUpdate === "restore") {
    return source === "Task" ? "In Progress" : "Scheduled";
  }
  if (statusUpdate === "Started" && source !== "Task") {
    return "Scheduled";
  }
  return statusUpdate;
}
