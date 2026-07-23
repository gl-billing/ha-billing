/** Scheduled jobs in repo root `vercel.json` — keep in sync with deploy crons. */
export type CronJobId =
  | "sheets-backup"
  | "refresh-dashboard"
  | "hearing-reminders"
  | "staff-digest"
  | "daily-digest"
  | "bir-deadlines"
  | "partner-weekly"
  | "pre-hearing-briefs"
  | "birthday-greetings"
  | "prep-nudges"
  | "post-hearing-warnings"
  | "task-repairs"
  | "retainer-billing"
  | "retainer-digest";

export type CronJobDefinition = {
  id: CronJobId;
  label: string;
  schedule: string;
  scheduleHint: string;
  /** Needs Tasks Apps Script web app. */
  tasksScript?: boolean;
  /** Needs billing Apps Script web app. */
  billingScript?: boolean;
  /** Needs CRON_GOOGLE_REFRESH_TOKEN for Sheets writes / Gmail. */
  googleToken?: boolean;
};

export const CRON_JOBS: CronJobDefinition[] = [
  {
    id: "sheets-backup",
    label: "Nightly spreadsheet backup",
    schedule: "0 18 * * *",
    scheduleHint: "Daily 2:00 AM PH",
    billingScript: true,
    googleToken: true
  },
  {
    id: "refresh-dashboard",
    label: "Hourly dashboard refresh",
    schedule: "0 * * * *",
    scheduleHint: "Every hour",
    billingScript: true
  },
  {
    id: "hearing-reminders",
    label: "Hearing reminders",
    schedule: "0 7 * * *",
    scheduleHint: "Daily 3:00 PM PH",
    tasksScript: true,
    googleToken: true
  },
  {
    id: "staff-digest",
    label: "Morning staff digest",
    schedule: "0 23 * * *",
    scheduleHint: "Daily 7:00 AM PH",
    tasksScript: true
  },
  {
    id: "daily-digest",
    label: "Firm daily digest email",
    schedule: "0 22 * * *",
    scheduleHint: "Daily 6:00 AM PH",
    googleToken: true
  },
  {
    id: "bir-deadlines",
    label: "BIR deadline tasks",
    schedule: "0 0 1 * *",
    scheduleHint: "Monthly",
    tasksScript: true,
    googleToken: true
  },
  {
    id: "partner-weekly",
    label: "Partner weekly report",
    schedule: "0 6 * * 1",
    scheduleHint: "Mondays 2:00 PM PH",
    tasksScript: true,
    googleToken: true
  },
  {
    id: "pre-hearing-briefs",
    label: "Pre-hearing brief emails",
    schedule: "0 6 * * *",
    scheduleHint: "Daily 2:00 PM PH",
    tasksScript: true,
    googleToken: true
  },
  {
    id: "birthday-greetings",
    label: "Birthday greeting tasks",
    schedule: "0 0 * * *",
    scheduleHint: "Daily midnight UTC",
    tasksScript: true,
    googleToken: true
  },
  {
    id: "prep-nudges",
    label: "Hearing prep nudges",
    schedule: "0 7 * * *",
    scheduleHint: "Daily 3:00 PM PH",
    googleToken: true
  },
  {
    id: "post-hearing-warnings",
    label: "Post-hearing outcome warnings",
    schedule: "0 8 * * *",
    scheduleHint: "Daily 4:00 PM PH",
    googleToken: true
  },
  {
    id: "task-repairs",
    label: "Sheet task repairs",
    schedule: "30 8 * * *",
    scheduleHint: "Daily 4:30 PM PH (after warnings)",
    googleToken: true
  },
  {
    id: "retainer-billing",
    label: "Retainer fee post & SOA email",
    schedule: "0 0 * * *",
    scheduleHint: "Daily midnight UTC (8:00 AM PH)",
    googleToken: true
  },
  {
    id: "retainer-digest",
    label: "Retainer eve digest (day before dues)",
    schedule: "0 22 * * *",
    scheduleHint: "Daily 6:00 AM PH (with firm digest)",
    googleToken: true
  }
];

export function cronJobById(id: string): CronJobDefinition | undefined {
  return CRON_JOBS.find((job) => job.id === id);
}
