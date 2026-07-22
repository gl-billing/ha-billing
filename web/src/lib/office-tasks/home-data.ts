import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { EmployeeStat } from "@/lib/office-tasks/schedule";

export type TasksHomeCounts = {
  tasksDueToday: number;
  eventsToday: number;
  deadlinesToday: number;
  overdueOpen: number;
  dueThisWeek: number;
  waitingAndStarted: number;
  completedToday: number;
};

export type TasksHomeData = {
  counts: TasksHomeCounts;
  lists: {
    overdue: OfficeItem[];
    eventsToday: OfficeItem[];
    deadlinesToday: OfficeItem[];
    tasksDueToday: OfficeItem[];
    dueThisWeek: OfficeItem[];
    waitingAndStarted: OfficeItem[];
    doneToday: OfficeItem[];
  };
  employees: string[];
  employeeDirectory: EmployeeRecord[];
  options: EntryFormOptions;
  searchResults: OfficeItem[];
  items: OfficeItem[];
  today: string;
  weekStart: string;
  employeeStats: EmployeeStat[];
  spreadsheetId?: string;
  tasksAppsScriptConfigured?: boolean;
  tasksSpreadsheetFallback?: boolean;
  isAdmin?: boolean;
  canViewLiaisonConfidential?: boolean;
};
