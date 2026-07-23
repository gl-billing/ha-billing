import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  deskChecklistIsWaitingOnClient,
  deskChecklistItemTitle
} from "@/lib/office-tasks/desk-checklist";
import { formatDisplayDate, normalizeOfficeStatus } from "@/lib/office-tasks/date-only";
import { filterTodayLists } from "@/lib/office-tasks/today-lists";
import { myWorkItemKindLabel, shortCalendarLabel } from "@/lib/office-tasks/schedule";
import { getAdminEmails } from "@/lib/admin";

/** Monochrome firm letterhead — ink / paper / hairline (matches firm-email-shell). */
const EMAIL = {
  ink: "#0a0a0a",
  muted: "#454545",
  line: "#e0e0e0",
  paper: "#ffffff",
  soft: "#f6f6f4",
  white: "#ffffff"
} as const;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://ha-billing.vercel.app"
) + "/app";

export type DailyDigestTodayChecklist = {
  tasksDueToday: OfficeItem[];
  eventsToday: OfficeItem[];
  deadlinesToday: OfficeItem[];
};

export type DailyDigestContent = {
  today: string;
  dateLabel: string;
  todayChecklist: DailyDigestTodayChecklist;
  overdue: OfficeItem[];
  waiting: OfficeItem[];
  overdueSummary: string;
  waitingSummary: string;
  counts: {
    todayTotal: number;
    overdue: number;
    waiting: number;
    waitingOnClient: number;
    started: number;
  };
};

function parseEmailList(raw: string | undefined): string[] {
  return raw?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
}

/** Comma-separated DAILY_DIGEST_EMAILS, then ADMIN_EMAILS, then FIRM_SENDER_EMAIL. */
export function getDailyDigestRecipients(): string[] {
  const dedicated = parseEmailList(process.env.DAILY_DIGEST_EMAILS);
  if (dedicated.length) return dedicated;

  const admins = getAdminEmails();
  if (admins.length) return admins;

  const firmInbox = process.env.FIRM_SENDER_EMAIL?.trim().toLowerCase();
  return firmInbox ? [firmInbox] : [];
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matterCount(items: OfficeItem[]): number {
  return new Set(items.map((item) => item.clientCase.trim()).filter(Boolean)).size;
}

function urgentHighCount(items: OfficeItem[]): number {
  return items.filter((item) => {
    const p = item.priority.trim();
    return p === "Urgent" || p === "High";
  }).length;
}

function oldestItem(items: OfficeItem[]): OfficeItem | null {
  if (!items.length) return null;
  return items.reduce((oldest, item) => {
    if (!oldest.date) return item;
    if (!item.date) return oldest;
    return item.date < oldest.date ? item : oldest;
  });
}

function sampleTitles(items: OfficeItem[], limit = 3): string[] {
  return items.slice(0, limit).map((item) => deskChecklistItemTitle(item));
}

export function summarizeOverdueParagraph(overdue: OfficeItem[]): string {
  if (!overdue.length) {
    return "No overdue open items — the firm backlog is clear for now.";
  }

  const count = overdue.length;
  const matters = matterCount(overdue);
  const urgent = urgentHighCount(overdue);
  const oldest = oldestItem(overdue);
  const samples = sampleTitles(overdue);

  const parts: string[] = [];
  parts.push(
    `There ${count === 1 ? "is" : "are"} ${count} overdue open item${count === 1 ? "" : "s"} across ${matters} matter${matters === 1 ? "" : "s"}.`
  );

  if (urgent > 0) {
    parts.push(
      `${urgent} ${urgent === 1 ? "is" : "are"} marked Urgent or High priority and should be cleared first.`
    );
  }

  if (oldest?.date) {
    parts.push(
      `The oldest is due ${formatDisplayDate(oldest.date, "short")} (${deskChecklistItemTitle(oldest)}).`
    );
  }

  if (samples.length) {
    parts.push(`Examples: ${samples.join("; ")}.`);
  }

  return parts.join(" ");
}

export function summarizeWaitingParagraph(waiting: OfficeItem[], today: string): string {
  if (!waiting.length) {
    return "Nothing is in Waiting or Started status right now.";
  }

  const count = waiting.length;
  const matters = matterCount(waiting);
  const onClient = waiting.filter((item) => deskChecklistIsWaitingOnClient(item, today)).length;
  const started = waiting.filter((item) => normalizeOfficeStatus(item.status) === "Started").length;
  const plainWaiting = waiting.filter((item) => normalizeOfficeStatus(item.status) === "Waiting").length;
  const samples = sampleTitles(waiting);

  const parts: string[] = [];
  parts.push(
    `${count} open item${count === 1 ? "" : "s"} across ${matters} matter${matters === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} in Waiting or Started status.`
  );

  if (onClient > 0) {
    parts.push(
      `${onClient} appear${onClient === 1 ? "s" : ""} to be waiting on client follow-up.`
    );
  }

  if (started > 0 && plainWaiting > 0) {
    parts.push(`${started} started in-house and ${plainWaiting} marked Waiting.`);
  } else if (started > 0) {
    parts.push(`${started} ${started === 1 ? "is" : "are"} actively Started in-house.`);
  }

  if (samples.length) {
    parts.push(`Includes: ${samples.join("; ")}.`);
  }

  return parts.join(" ");
}

export function buildDailyDigestContent(items: OfficeItem[], today: string): DailyDigestContent {
  void today;
  const lists = filterTodayLists(items);
  const todayChecklist: DailyDigestTodayChecklist = {
    tasksDueToday: lists.tasksDueToday,
    eventsToday: lists.eventsToday,
    deadlinesToday: lists.deadlinesToday
  };
  const overdue = lists.overdue;
  const waiting = lists.waitingAndStarted;

  const waitingOnClient = waiting.filter((item) => deskChecklistIsWaitingOnClient(item, today)).length;
  const started = waiting.filter((item) => normalizeOfficeStatus(item.status) === "Started").length;

  return {
    today,
    dateLabel: formatDisplayDate(today),
    todayChecklist,
    overdue,
    waiting,
    overdueSummary: summarizeOverdueParagraph(overdue),
    waitingSummary: summarizeWaitingParagraph(waiting, today),
    counts: {
      todayTotal:
        todayChecklist.tasksDueToday.length +
        todayChecklist.eventsToday.length +
        todayChecklist.deadlinesToday.length,
      overdue: overdue.length,
      waiting: waiting.length,
      waitingOnClient,
      started
    }
  };
}

export function buildDailyDigestSubject(content: DailyDigestContent): string {
  const { counts } = content;
  const parts: string[] = [];

  if (counts.todayTotal > 0) {
    parts.push(`${counts.todayTotal} today`);
  }
  if (counts.overdue > 0) {
    parts.push(`${counts.overdue} overdue`);
  }
  if (counts.waiting > 0) {
    parts.push(`${counts.waiting} waiting`);
  }

  const tail = parts.length ? ` — ${parts.join(", ")}` : " — all clear";
  return `HA Office daily digest${tail} · ${content.dateLabel}`;
}

function renderChecklistRow(item: OfficeItem): string {
  const kind = myWorkItemKindLabel(item);
  const title = deskChecklistItemTitle(item);
  const assignee = item.assignedTo?.trim();
  const meta: string[] = [];
  if (item.source === "Event" && item.startTime) meta.push(item.startTime);
  if (assignee) meta.push(assignee);

  return (
    `<tr>` +
    `<td style="padding:10px 0;border-bottom:1px solid ${EMAIL.line};vertical-align:top;">` +
    `<span style="display:inline-block;min-width:72px;padding:2px 8px;font-size:10px;font-weight:700;` +
    `letter-spacing:0.06em;text-transform:uppercase;background:${EMAIL.paper};border:1px solid ${EMAIL.line};` +
    `color:${EMAIL.muted};">${escapeHtml(kind || shortCalendarLabel(item))}</span>` +
    `</td>` +
    `<td style="padding:10px 8px;border-bottom:1px solid ${EMAIL.line};vertical-align:top;">` +
    `<p style="margin:0;font-size:14px;line-height:1.45;font-weight:600;color:${EMAIL.ink};">${escapeHtml(title)}</p>` +
  (item.details?.trim()
    ? `<p style="margin:4px 0 0;font-size:13px;line-height:1.45;color:${EMAIL.muted};">${escapeHtml(item.details.trim())}</p>`
    : "") +
    `</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid ${EMAIL.line};vertical-align:top;text-align:right;` +
    `font-size:12px;line-height:1.45;color:${EMAIL.muted};white-space:nowrap;">${escapeHtml(meta.join(" · "))}</td>` +
    `</tr>`
  );
}

function renderChecklistSection(title: string, items: OfficeItem[]): string {
  if (!items.length) return "";

  const rows = items.map(renderChecklistRow).join("");
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="margin:0 0 16px;border:1px solid ${EMAIL.line};background:${EMAIL.paper};">` +
    `<tr><td style="padding:14px 16px 8px;">` +
    `<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL.muted};">` +
    `${escapeHtml(title)} (${items.length})</p>` +
    `</td></tr>` +
    `<tr><td style="padding:0 16px 12px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>` +
    `</td></tr></table>`
  );
}

function renderSummaryParagraph(label: string, text: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="margin:0 0 18px;border:1px solid ${EMAIL.line};background:${EMAIL.paper};">` +
    `<tr><td style="padding:14px 16px;">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL.muted};">` +
    `${escapeHtml(label)}</p>` +
    `<p style="margin:0;font-size:15px;line-height:1.6;color:${EMAIL.ink};">${escapeHtml(text)}</p>` +
    `</td></tr></table>`
  );
}

export function buildDailyDigestHtml(content: DailyDigestContent): string {
  const { todayChecklist, counts } = content;
  const checklistSections = [
    renderChecklistSection("Hearings & events today", todayChecklist.eventsToday),
    renderChecklistSection("Deadlines & filings today", todayChecklist.deadlinesToday),
    renderChecklistSection("Tasks due today", todayChecklist.tasksDueToday)
  ].join("");

  const todayBlock =
    counts.todayTotal > 0
      ? checklistSections
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
        `style="margin:0 0 16px;border:1px solid ${EMAIL.line};background:${EMAIL.paper};">` +
        `<tr><td style="padding:20px 16px;text-align:center;">` +
        `<p style="margin:0;font-size:15px;color:${EMAIL.muted};">No tasks, hearings, or deadlines scheduled for today.</p>` +
        `</td></tr></table>`;

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${EMAIL.soft};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${EMAIL.soft};padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">` +
    `<tr><td style="height:2px;background:${EMAIL.ink};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:22px 24px 18px;background:${EMAIL.paper};border-left:1px solid ${EMAIL.line};border-right:1px solid ${EMAIL.line};">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${EMAIL.muted};">Hernandez &amp; Associates</p>` +
    `<h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;line-height:1.25;color:${EMAIL.ink};">Firm daily digest</h1>` +
    `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL.muted};">${escapeHtml(content.dateLabel)} · firm-wide open work</p>` +
    `</td></tr>` +
    `<tr><td style="padding:20px 18px 8px;background:${EMAIL.paper};border-left:1px solid ${EMAIL.line};border-right:1px solid ${EMAIL.line};">` +
    `<p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL.muted};">Today</p>` +
    todayBlock +
    renderSummaryParagraph("Overdue", content.overdueSummary) +
    renderSummaryParagraph("Waiting", content.waitingSummary) +
    `</td></tr>` +
    `<tr><td style="padding:18px 20px 22px;background:${EMAIL.paper};border:1px solid ${EMAIL.line};border-top:0;text-align:center;">` +
    `<a href="${escapeHtml(APP_URL)}" style="display:inline-block;padding:12px 28px;background:${EMAIL.ink};` +
    `color:${EMAIL.white};font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;` +
    `text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">Open HA Office</a>` +
    `<p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:${EMAIL.muted};">Firm-wide summary · Per-staff reminders still go out via the morning staff digest.</p>` +
    `</td></tr></table></td></tr></table></body></html>`
  );
}

export function buildDailyDigestPlainText(content: DailyDigestContent): string {
  const lines: string[] = [
    `HA Office firm daily digest — ${content.dateLabel}`,
    "",
    "TODAY",
    formatChecklistPlain(content.todayChecklist),
    "",
    "OVERDUE",
    content.overdueSummary,
    "",
    "WAITING",
    content.waitingSummary,
    "",
    `Open: ${APP_URL}`
  ];
  return lines.join("\n");
}

function formatChecklistPlain(checklist: DailyDigestTodayChecklist): string {
  const sections: Array<[string, OfficeItem[]]> = [
    ["Hearings & events", checklist.eventsToday],
    ["Deadlines & filings", checklist.deadlinesToday],
    ["Tasks due today", checklist.tasksDueToday]
  ];

  const lines: string[] = [];
  for (const [label, items] of sections) {
    if (!items.length) continue;
    lines.push(`${label}:`);
    for (const item of items) {
      const meta = [myWorkItemKindLabel(item), item.assignedTo?.trim()].filter(Boolean).join(" · ");
      lines.push(`- ${deskChecklistItemTitle(item)}${meta ? ` (${meta})` : ""}`);
    }
  }

  if (!lines.length) {
    return "No tasks, hearings, or deadlines scheduled for today.";
  }
  return lines.join("\n");
}
