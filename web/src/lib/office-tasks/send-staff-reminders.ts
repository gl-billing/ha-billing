import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { OfficeItem } from "@/lib/office-tasks/sheets/items";
import {
  formatDisplayDate,
  getEmployeeItemGroups,
  itemTone,
  shortCalendarLabel
} from "@/lib/office-tasks/schedule";
import { effectiveReminderScope, type ReminderScope } from "@/lib/office-tasks/reminders";
import { staleFollowUpsForAssignee } from "@/lib/office-tasks/stale-follow-ups";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  sendHtmlEmailViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";

const EMAIL = {
  ink: "#0a0a0a",
  muted: "#4a4a4a",
  line: "#d4d4d4",
  paper: "#ffffff",
  cream: "#ffffff",
  accent: "#111111",
  accentDark: "#0a0a0a",
  red: "#b91c1c",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  green: "#166534",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  blue: "#1d4ed8",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  rose: "#be123c",
  roseBg: "#fff1f2",
  roseBorder: "#fecdd3",
  charcoal: "#2b251d",
  soft: "#f3f0ea"
} as const;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://ha-billing.vercel.app"
) + "/app";

export type ReminderSendDetail = {
  assignee: string;
  email: string;
  dueToday: number;
  overdue: number;
  status: "sent" | "skipped" | "error";
  note?: string;
};

type SendResult = {
  ok: boolean;
  message: string;
  skipped?: boolean;
  dueToday?: number;
  overdue?: number;
  sent?: number;
  skippedCount?: number;
  errors?: string[];
  details?: ReminderSendDetail[];
};

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function scopeFlags(scope: ReminderScope) {
  return {
    sendDaily: scope === "daily" || scope === "both",
    sendOverdue: scope === "overdue" || scope === "both"
  };
}

function shouldSkipReminder(scope: ReminderScope, dueToday: number, overdue: number): boolean {
  const { sendDaily, sendOverdue } = scopeFlags(scope);
  if (sendDaily && sendOverdue) return dueToday === 0 && overdue === 0;
  if (sendDaily) return dueToday === 0;
  if (sendOverdue) return overdue === 0;
  return true;
}

function buildSubject(name: string, dueToday: number, overdue: number, scope: ReminderScope): string {
  const { sendDaily, sendOverdue } = scopeFlags(scope);
  if (sendOverdue && overdue > 0) {
    const tail = sendDaily && dueToday > 0 ? ` + ${dueToday} due today` : "";
    return `HA Office — Start with ${overdue} overdue${tail} · ${name}`;
  }
  if (sendDaily && dueToday > 0) {
    return `HA Office — ${dueToday} item${dueToday === 1 ? "" : "s"} due today · ${name}`;
  }
  return `HA Office — Task summary · ${name}`;
}

function priorityRank(priority: string): number {
  const order = ["Urgent", "High", "Medium", "Low"];
  const i = order.indexOf(priority.trim());
  return i === -1 ? 99 : i;
}

function sortItemsForEmail(items: OfficeItem[]): OfficeItem[] {
  return [...items].sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      (a.date || "").localeCompare(b.date || "") ||
      a.clientCase.localeCompare(b.clientCase)
  );
}

function toneEmailStyle(tone: ReturnType<typeof itemTone>): {
  label: string;
  bg: string;
  border: string;
  text: string;
} {
  switch (tone) {
    case "overdue":
      return { label: "Overdue", bg: EMAIL.redBg, border: EMAIL.redBorder, text: EMAIL.red };
    case "deadline":
      return { label: "Filing", bg: EMAIL.roseBg, border: EMAIL.roseBorder, text: EMAIL.rose };
    case "event":
      return { label: "Hearing", bg: EMAIL.blueBg, border: EMAIL.blueBorder, text: EMAIL.blue };
    case "started":
      return { label: "Started", bg: EMAIL.cream, border: EMAIL.line, text: EMAIL.accentDark };
    case "waiting":
      return { label: "Waiting", bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" };
    default:
      return { label: "Task", bg: EMAIL.greenBg, border: EMAIL.greenBorder, text: EMAIL.green };
  }
}

function renderPriorityBadge(priority: string): string {
  const p = priority.trim();
  if (!p || p === "Medium" || p === "Low") return "";
  const urgent = p === "Urgent";
  const bg = urgent ? EMAIL.redBg : "#fff7ed";
  const border = urgent ? EMAIL.redBorder : "#fed7aa";
  const text = urgent ? EMAIL.red : "#c2410c";
  return (
    `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;` +
    `font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;` +
    `background:${bg};border:1px solid ${border};color:${text};">${escapeHtml(p)}</span>`
  );
}

function renderItemCard(item: OfficeItem, stepNumber?: number): string {
  const tone = itemTone(item);
  const style = toneEmailStyle(tone);
  const typeLabel = shortCalendarLabel(item);
  const dateLabel = item.date ? formatDisplayDate(item.date, "short") : "No date";
  const meta: string[] = [];
  if (item.source === "Event" && item.startTime) meta.push(`Time: ${escapeHtml(item.startTime)}`);
  if (item.venue) meta.push(escapeHtml(item.venue));
  if (item.status && item.status !== "In Progress") meta.push(escapeHtml(item.status));

  const step =
    typeof stepNumber === "number"
      ? `<td style="width:36px;vertical-align:top;padding:16px 0 16px 16px;">` +
        `<div style="width:28px;height:28px;border-radius:999px;background:${style.text};color:#fff;` +
        `font-size:13px;font-weight:700;line-height:28px;text-align:center;font-family:Arial,sans-serif;">${stepNumber}</div></td>`
      : "";

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="margin-bottom:12px;border:1px solid ${style.border};border-radius:12px;background:${EMAIL.paper};overflow:hidden;">` +
    `<tr>${step}<td style="padding:16px 16px 16px ${step ? "8px" : "16px"};vertical-align:top;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td>` +
    `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;` +
    `letter-spacing:0.08em;text-transform:uppercase;background:${style.bg};border:1px solid ${style.border};` +
    `color:${style.text};">${escapeHtml(typeLabel)}</span>${renderPriorityBadge(item.priority)}` +
    `</td><td align="right" style="font-size:12px;color:${EMAIL.muted};white-space:nowrap;">${escapeHtml(dateLabel)}</td></tr></table>` +
    `<p style="margin:10px 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;` +
    `line-height:1.35;color:${EMAIL.ink};">${escapeHtml(item.clientCase || "General")}</p>` +
    (item.details
      ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${EMAIL.muted};">${escapeHtml(item.details)}</p>`
      : "") +
    (meta.length
      ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.45;color:${EMAIL.muted};">${meta.join(" · ")}</p>`
      : "") +
    (item.nextAction
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
        `style="background:${EMAIL.cream};border:1px solid ${EMAIL.line};border-radius:8px;">` +
        `<tr><td style="padding:10px 12px;">` +
        `<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL.accentDark};">Your next step</p>` +
        `<p style="margin:0;font-size:14px;line-height:1.5;font-weight:600;color:${EMAIL.ink};">${escapeHtml(item.nextAction)}</p>` +
        `</td></tr></table>`
      : `<p style="margin:0;font-size:12px;font-style:italic;color:${EMAIL.muted};">Open HA Office to review details and mark done when finished.</p>`) +
    `</td></tr></table>`
  );
}

function renderSection(
  title: string,
  subtitle: string,
  items: OfficeItem[],
  accent: { bg: string; border: string; text: string },
  numbered = false
): string {
  if (!items.length) return "";
  const sorted = sortItemsForEmail(items);
  const cards = sorted
    .map((item, index) => renderItemCard(item, numbered ? index + 1 : undefined))
    .join("");

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="margin:0 0 20px;border:1px solid ${accent.border};border-radius:14px;background:${accent.bg};">` +
    `<tr><td style="padding:16px 18px 8px;">` +
    `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accent.text};">${escapeHtml(title)}</p>` +
    `<p style="margin:0;font-size:13px;line-height:1.45;color:${EMAIL.muted};">${escapeHtml(subtitle)}</p>` +
    `</td></tr><tr><td style="padding:0 12px 14px;">${cards}</td></tr></table>`
  );
}

function renderSummaryStats(overdue: number, dueToday: number, scope: ReminderScope): string {
  const { sendDaily, sendOverdue } = scopeFlags(scope);
  const cells: string[] = [];

  if (sendOverdue) {
    cells.push(
      `<td width="50%" style="padding:6px;">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
        `style="background:${overdue ? EMAIL.redBg : EMAIL.paper};border:1px solid ${overdue ? EMAIL.redBorder : EMAIL.line};border-radius:12px;">` +
        `<tr><td style="padding:14px 16px;text-align:center;">` +
        `<div style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1;color:${overdue ? EMAIL.red : EMAIL.muted};">${overdue}</div>` +
        `<div style="margin-top:4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${overdue ? EMAIL.red : EMAIL.muted};">Overdue</div>` +
        `</td></tr></table></td>`
    );
  }

  if (sendDaily) {
    cells.push(
      `<td width="50%" style="padding:6px;">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
        `style="background:${dueToday ? EMAIL.greenBg : EMAIL.paper};border:1px solid ${dueToday ? EMAIL.greenBorder : EMAIL.line};border-radius:12px;">` +
        `<tr><td style="padding:14px 16px;text-align:center;">` +
        `<div style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1;color:${dueToday ? EMAIL.green : EMAIL.muted};">${dueToday}</div>` +
        `<div style="margin-top:4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${dueToday ? EMAIL.green : EMAIL.muted};">Due today</div>` +
        `</td></tr></table></td>`
    );
  }

  if (!cells.length) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr>${cells.join("")}</tr></table>`;
}

function buildHtml(
  name: string,
  dueToday: OfficeItem[],
  overdue: OfficeItem[],
  today: string,
  scope: ReminderScope,
  staleFollowUps: OfficeItem[] = []
): string {
  const { sendDaily, sendOverdue } = scopeFlags(scope);
  const dateLabel = formatDisplayDate(today);
  const hasOverdue = sendOverdue && overdue.length > 0;
  const hasToday = sendDaily && dueToday.length > 0;
  const focusLine = hasOverdue
    ? "Start with the numbered overdue items below — these are past due and need attention first."
    : hasToday
      ? "Work through today’s list in order. Each card shows your next step."
      : "You’re caught up for this reminder.";

  const bodySections: string[] = [];

  if (hasOverdue) {
    bodySections.push(
      renderSection(
        "Fix first — overdue",
        "These are past their due date. Handle these before new work.",
        overdue,
        { bg: EMAIL.redBg, border: EMAIL.redBorder, text: EMAIL.red },
        true
      )
    );
  }

  if (hasToday) {
    bodySections.push(
      renderSection(
        hasOverdue ? "Then — due today" : "Due today",
        hasOverdue ? "After overdue items, focus on what must be completed today." : "Complete these before end of day.",
        dueToday,
        { bg: EMAIL.greenBg, border: EMAIL.greenBorder, text: EMAIL.green },
        !hasOverdue
      )
    );
  }

  if (staleFollowUps.length) {
    bodySections.push(
      renderSection(
        "Still waiting — no update in 7+ days",
        "These Waiting/Started items need a status check or next step.",
        staleFollowUps,
        { bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6" },
        false
      )
    );
  }

  if (!hasOverdue && !hasToday) {
    bodySections.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
        `style="margin:0 0 20px;border:1px solid ${EMAIL.line};border-radius:14px;background:${EMAIL.paper};">` +
        `<tr><td style="padding:24px 20px;text-align:center;">` +
        `<p style="margin:0;font-size:15px;color:${EMAIL.muted};">No open items in this reminder. You're all set for now.</p>` +
        `</td></tr></table>`
    );
  }

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${EMAIL.cream};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${EMAIL.cream};padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">` +
    `<tr><td style="height:2.5px;background:${EMAIL.accentDark};font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:22px 24px 18px;background:${EMAIL.paper};border-left:1px solid ${EMAIL.line};border-right:1px solid ${EMAIL.line};">` +
    `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${EMAIL.muted};">Hernandez &amp; Associates</p>` +
    `<h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;line-height:1.25;color:${EMAIL.ink};">` +
    `Good day, <span style="color:${EMAIL.charcoal};">${escapeHtml(name)}</span></h1>` +
    `<p style="margin:0;font-size:15px;line-height:1.5;color:${EMAIL.muted};">Your office task briefing · ${escapeHtml(dateLabel)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding:20px 18px 8px;background:${EMAIL.paper};border-left:1px solid ${EMAIL.line};border-right:1px solid ${EMAIL.line};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;background:${EMAIL.cream};border:1px solid ${EMAIL.line};border-radius:10px;">` +
    `<tr><td style="padding:12px 14px;">` +
    `<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL.accentDark};">How to read this email</p>` +
    `<p style="margin:0;font-size:14px;line-height:1.55;color:${EMAIL.ink};">${escapeHtml(focusLine)}</p>` +
    `</td></tr></table>` +
    renderSummaryStats(overdue.length, dueToday.length, scope) +
    bodySections.join("") +
    `</td></tr>` +
    `<tr><td style="padding:18px 20px 22px;background:${EMAIL.soft};border:1px solid ${EMAIL.line};border-top:0;border-radius:0 0 16px 16px;text-align:center;">` +
    `<a href="${escapeHtml(APP_URL)}" style="display:inline-block;padding:12px 28px;border-radius:2px;background:${EMAIL.accentDark};` +
    `color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">Open HA Office Tasks</a>` +
    `<p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:${EMAIL.muted};">Mark items done in the app when finished · Questions? Reply to this email or contact the office.</p>` +
    `</td></tr></table></td></tr></table></body></html>`
  );
}

export async function sendStaffReminderEmail(
  accessToken: string,
  senderEmail: string,
  assignee: string,
  email: string,
  items: OfficeItem[],
  today: string,
  scope: ReminderScope,
  roster: string[] = []
): Promise<SendResult> {
  const name = assignee.trim();
  if (!name) return { ok: false, message: "Assignee name is required." };

  const recipient = normalizeEmailAddress(email);
  if (!recipient) return { ok: false, message: `No email on Employees sheet for: ${name}` };
  if (!isValidEmailAddress(recipient)) {
    return { ok: false, message: `Invalid email on Employees sheet for ${name}: ${email}` };
  }

  const groups = getEmployeeItemGroups(name, items, today, [], roster);
  const dueToday = groups.dueToday.length;
  const overdue = groups.overdue.length;
  const deliveryScope = effectiveReminderScope(scope, overdue);

  const staleFollowUps = staleFollowUpsForAssignee(items, name, today);

  if (
    shouldSkipReminder(deliveryScope, dueToday, overdue) &&
    staleFollowUps.length === 0
  ) {
    return {
      ok: true,
      message: `No ${scope === "daily" ? "due-today" : scope === "overdue" ? "overdue" : "daily or overdue"} items for ${name} — email skipped.`,
      skipped: true,
      dueToday,
      overdue
    };
  }

  const subject = buildSubject(name, dueToday, overdue, deliveryScope);
  const html = buildHtml(name, groups.dueToday, groups.overdue, today, deliveryScope, staleFollowUps);
  const sender = normalizeEmailAddress(senderEmail);
  const delivery = await sendHtmlEmailViaGmail({
    accessToken,
    fromEmail: sender,
    to: recipient,
    subject,
    html,
    bcc: sender !== recipient ? sender : undefined
  });

  return {
    ok: true,
    message: `${sentMailHint(delivery.senderEmail, recipient, delivery.messageId, sender !== recipient)} (${name})`,
    dueToday,
    overdue
  };
}

export async function sendTestReminderEmail(
  accessToken: string,
  senderEmail: string,
  assignee: string,
  email: string,
  items: OfficeItem[],
  today: string,
  scope: ReminderScope,
  roster: string[] = []
): Promise<SendResult> {
  const name = assignee.trim() || "Staff";
  const recipient = normalizeEmailAddress(senderEmail);
  const groups = getEmployeeItemGroups(name, items, today, [], roster);
  const dueToday = groups.dueToday.length;
  const overdue = groups.overdue.length;
  const deliveryScope = effectiveReminderScope(scope, overdue);
  const subject = `[TEST] ${buildSubject(name, dueToday, overdue, deliveryScope)}`;
  const html =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ` +
    `style="max-width:600px;margin:0 auto 16px;border:1px dashed ${EMAIL.line};border-radius:12px;background:${EMAIL.cream};">` +
    `<tr><td style="padding:12px 16px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#92400e;">` +
    `<strong>Test email</strong> — you are previewing what staff will receive. ` +
    `Live delivery would go to <strong>${escapeHtml(normalizeEmailAddress(email) || "—")}</strong>.` +
    `</td></tr></table>` +
    buildHtml(name, groups.dueToday, groups.overdue, today, deliveryScope, staleFollowUpsForAssignee(items, name, today));

  const delivery = await sendHtmlEmailViaGmail({
    accessToken,
    fromEmail: recipient,
    to: recipient,
    subject,
    html
  });

  return {
    ok: true,
    message: `[TEST] ${sentMailHint(delivery.senderEmail, recipient, delivery.messageId)}`,
    dueToday,
    overdue
  };
}

export async function sendAllStaffReminderEmails(
  accessToken: string,
  senderEmail: string,
  directory: EmployeeRecord[],
  items: OfficeItem[],
  today: string,
  scope: ReminderScope
): Promise<SendResult> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const details: ReminderSendDetail[] = [];
  const roster = directory.map((employee) => employee.name).filter(Boolean);

  for (const emp of directory) {
    const groups = getEmployeeItemGroups(emp.name, items, today, [], roster);
    const dueToday = groups.dueToday.length;
    const overdue = groups.overdue.length;
    const recipient = normalizeEmailAddress(emp.email);

    if (!recipient) {
      errors.push(`${emp.name} (no email)`);
      details.push({
        assignee: emp.name,
        email: "",
        dueToday,
        overdue,
        status: "error",
        note: "No email in column B"
      });
      continue;
    }

    try {
      const result = await sendStaffReminderEmail(
        accessToken,
        senderEmail,
        emp.name,
        emp.email,
        items,
        today,
        scope,
        roster
      );
      if (result.ok && result.skipped) {
        skipped++;
        details.push({
          assignee: emp.name,
          email: recipient,
          dueToday,
          overdue,
          status: "skipped",
          note: "No matching items for this scope"
        });
      } else if (result.ok) {
        sent++;
        details.push({
          assignee: emp.name,
          email: recipient,
          dueToday,
          overdue,
          status: "sent"
        });
      } else {
        errors.push(`${emp.name}: ${result.message}`);
        details.push({
          assignee: emp.name,
          email: recipient,
          dueToday,
          overdue,
          status: "error",
          note: result.message
        });
      }
    } catch (error) {
      const note = error instanceof Error ? error.message : "Send failed";
      errors.push(`${emp.name}: ${note}`);
      details.push({
        assignee: emp.name,
        email: recipient,
        dueToday,
        overdue,
        status: "error",
        note
      });
    }
  }

  let message: string;
  if (sent === 0 && errors.length) {
    message = `No emails sent. ${errors.join("; ")}`;
  } else if (sent === 0 && skipped > 0) {
    message = `No emails sent — ${skipped} staff had no ${scope === "daily" ? "due-today" : scope === "overdue" ? "overdue" : "due-today or overdue"} items. Check assignee names match the Employees sheet.`;
  } else {
    message = `Sent ${sent} reminder(s)`;
    if (skipped) message += `, skipped ${skipped} (nothing to send)`;
    if (errors.length) message += `. Issues: ${errors.join("; ")}`;
  }

  return { ok: sent > 0 || (skipped > 0 && errors.length === 0), message, sent, skippedCount: skipped, errors, details };
}

export function plainTextPreview(html: string): string {
  return stripHtml(html);
}
