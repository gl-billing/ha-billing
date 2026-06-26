"use client";

import { EventAddForm } from "@/components/office-tasks/EventAddForm";
import type { SavedEventInfo } from "@/components/office-tasks/EventAddScheduleEmailDialog";
import { TaskAddForm } from "@/components/office-tasks/TaskAddForm";

export type { SavedEventInfo };

export type EntryFormOptions = {
  priorities: string[];
  taskTypes: string[];
  taskFormTypes?: string[];
  taskCreateStatuses: string[];
  eventCategories: string[];
  eventCreateStatuses: string[];
  filingModes: string[];
  pleadingTypes: string[];
  pleadingCaseNatures: string[];
  platforms: string[];
};

type TaskFormProps = {
  options: EntryFormOptions;
  busy: boolean;
  billingAccess?: boolean;
  onSubmit: (form: HTMLFormElement, clientCase: string) => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
};

type EventFormProps = {
  options: EntryFormOptions;
  employees?: string[];
  busy: boolean;
  billingAccess?: boolean;
  initialCategory?: string;
  eventKind?: import("@/lib/office-tasks/event-form-utils").EventAddKind;
  formTitle?: string;
  formSubtitle?: string;
  onSubmit: (form: HTMLFormElement, clientCase: string) => void | Promise<void>;
  onSaveEventForSchedule?: (form: HTMLFormElement, clientCase: string) => Promise<SavedEventInfo | null>;
  onScheduleEmailComplete?: (saved: SavedEventInfo) => void | Promise<void>;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function AddTaskForm(props: TaskFormProps) {
  return <TaskAddForm {...props} />;
}

export function AddEventForm(props: EventFormProps) {
  return <EventAddForm {...props} />;
}
