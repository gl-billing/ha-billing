/** Shared task/event row shape — safe for client and server imports. */

export type OfficeItem = {
  source: "Task" | "Event";
  sheetName: string;
  rowNumber: number;
  id: string;
  date: string | null;
  /** Event sheet column C — may differ from `date` when filing deadline is used */
  eventDate: string | null;
  filingDeadline: string | null;
  startTime: string | null;
  endTime: string | null;
  category: string;
  priority: string;
  assignedTo: string;
  clientCase: string;
  venue: string;
  details: string;
  previousAction: string;
  nextAction: string;
  status: string;
  done: boolean;
  completedDate: string | null;
  remarks: string;
  reminderDays: number;
  calendarSync: boolean;
  calendarEventId: string;
  lastUpdated: string | null;
  platform: string;
  filingMode: string;
  pleadingType: string;
  pleadingCaseNature: string;
  receivedDate: string | null;
  periodToFileDays: number;
  filingDate: string | null;
};

export type TodayCounts = {
  tasksDueToday: number;
  eventsToday: number;
  deadlinesToday: number;
  overdueOpen: number;
  waitingAndStarted: number;
  completedToday: number;
};
