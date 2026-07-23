"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { buildReminderPreview, scopeLabel, type ReminderScope } from "@/lib/office-tasks/reminders";

type Props = {
  items: OfficeItem[];
  today: string;
  weekDates: string[];
  directory: EmployeeRecord[];
  selectedAssignee?: string | null;
  isAdmin: boolean;
  busy: boolean;
  onStatus: (msg: string) => void;
  /** compact = Team; strip = Today owner bar; full = Tools */
  layout?: "compact" | "strip" | "full";
  /** Inside My work step card — hides duplicate title block. */
  embedded?: boolean;
};

export function StaffRemindersPanel({
  items,
  today,
  weekDates,
  directory,
  selectedAssignee,
  isAdmin,
  busy,
  onStatus,
  layout = "full",
  embedded = false
}: Props) {
  const [sending, setSending] = useState<string | null>(null);
  const [gmailReady, setGmailReady] = useState<boolean | null>(null);
  const [gmailSender, setGmailSender] = useState<string | null>(null);
  const [gmailHint, setGmailHint] = useState<string | null>(null);
  const [sendVia, setSendVia] = useState<"gmail" | "apps-script" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tasks/reminders")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setGmailReady(json.gmailSendReady === true);
          setGmailSender(json.gmailSenderEmail || null);
          setGmailHint(json.hint || null);
          setSendVia(json.via === "apps-script" ? "apps-script" : "gmail");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGmailReady(null);
          setGmailSender(null);
          setGmailHint(null);
          setSendVia(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roster = useMemo(
    () => directory.map((employee) => employee.name).filter(Boolean),
    [directory]
  );

  const previews = useMemo(() => {
    return directory.map((emp) =>
      buildReminderPreview(emp.name, emp.email, items, today, weekDates, roster)
    );
  }, [directory, items, today, weekDates, roster]);

  const totals = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    previews.forEach((p) => {
      dueToday += p.dueToday;
      overdue += p.overdue;
    });
    return { dueToday, overdue, staff: previews.filter((p) => p.canSend).length };
  }, [previews]);

  const selectedPreview = selectedAssignee
    ? previews.find((p) => p.assignee === selectedAssignee)
    : null;

  async function sendReminder(
    assignee: string,
    scope: ReminderScope,
    options?: { allStaff?: boolean; testToSelf?: boolean }
  ) {
    const allStaff = options?.allStaff;
    const testToSelf = options?.testToSelf;
    const key = testToSelf
      ? `test-${scope}`
      : allStaff
        ? `all-${scope}`
        : `${assignee}-${scope}`;
    setSending(key);
    onStatus(
      testToSelf
        ? `Sending test email to you (${scopeLabel(scope)})…`
        : allStaff
          ? `Sending ${scopeLabel(scope)} to all staff…`
          : `Sending reminder to ${assignee}…`
    );
    try {
      const res = await fetch("/api/tasks/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee: allStaff || testToSelf ? assignee || undefined : assignee,
          scope,
          allStaff,
          testToSelf
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");

      let message = json.message || "Reminder sent.";
      if (json.details?.length) {
        const lines = json.details
          .filter((row: { status: string }) => row.status !== "sent")
          .map(
            (row: { assignee: string; dueToday: number; overdue: number; status: string; note?: string }) =>
              `${row.assignee}: ${row.status} (today ${row.dueToday}, overdue ${row.overdue})${row.note ? ` — ${row.note}` : ""}`
          );
        if (lines.length) message += `\n${lines.join("\n")}`;
      }
      onStatus(message);
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Could not send reminder.");
    } finally {
      setSending(null);
    }
  }

  if (!isAdmin) {
    return null;
  }

  const noEmails = directory.length > 0 && directory.every((e) => !e.email);

  const ownerButtons = (
    <div className="owner-reminder-actions">
      <OwnerSendButton
        label="Email all staff — overdue first"
        sub={`${totals.dueToday + totals.overdue} item${totals.dueToday + totals.overdue === 1 ? "" : "s"} · includes overdue when any exist`}
        disabled={busy || Boolean(sending) || totals.staff === 0}
        loading={sending === "all-both"}
        variant="both"
        onClick={() => sendReminder("", "both", { allStaff: true })}
      />
      <OwnerSendButton
        label="Email all staff — overdue only"
        sub={`${totals.overdue} overdue item${totals.overdue === 1 ? "" : "s"} across team`}
        disabled={busy || Boolean(sending) || totals.staff === 0 || totals.overdue === 0}
        loading={sending === "all-overdue"}
        variant="overdue"
        onClick={() => sendReminder("", "overdue", { allStaff: true })}
      />
      <OwnerSendButton
        label="Email all staff — due today"
        sub={`${totals.dueToday} due today · auto-includes overdue if any`}
        disabled={busy || Boolean(sending) || totals.staff === 0}
        loading={sending === "all-daily"}
        variant="today"
        onClick={() => sendReminder("", "daily", { allStaff: true })}
      />
      <OwnerSendButton
        label="Send test to my inbox"
        sub="Confirms Gmail works before emailing staff"
        disabled={busy || Boolean(sending)}
        loading={sending === "test-both"}
        variant="test"
        onClick={() => sendReminder(selectedAssignee || previews[0]?.assignee || "", "both", { testToSelf: true })}
      />
    </div>
  );

  if (layout === "strip") {
    return (
      <section
        id="staff-email-reminders"
        className={`owner-reminder-strip ${embedded ? "owner-reminder-strip--embedded" : "card"} no-print border-line`}
      >
        {embedded ? null : (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="owner-reminder-badge">Owner / Admin</span>
              <h3 className="font-display mt-2 text-lg font-semibold text-ink">Send staff email reminders</h3>
              <p className="mt-1 text-xs text-muted">
                Each employee gets only their own tasks (due today or overdue). Sent from your signed-in Gmail.
                Daily reminders automatically include overdue items when any exist.
              </p>
            </div>
          </div>
        )}
        {directory.length === 0 && (
          <p className="status-bar status-bar-error mb-3 text-xs">Add staff on the Employees sheet (name + email in column B).</p>
        )}
        {noEmails && (
          <p className="mb-3 text-xs text-amber-900">Add emails in column B on the Employees sheet.</p>
        )}
        {gmailReady === false && (
          <p className="status-bar status-bar-error mb-3 text-xs">
            {gmailHint ||
              'Gmail send is not active. Sign out, sign in again in a private window, and approve "Send email on your behalf".'}
          </p>
        )}
        {sendVia === "apps-script" ? (
          <p className="status-bar status-bar-warn mb-3 text-xs">
            Server is using Apps Script for mail (not your Gmail). Remove TASKS_REMINDERS_VIA_APPS_SCRIPT on Vercel or
            finish Apps Script setup.
          </p>
        ) : null}
        {gmailSender ? (
          <p className="mb-3 text-xs text-muted">
            Sends from <strong>{gmailSender}</strong> · you receive a BCC copy · staff receive column B on Employees
          </p>
        ) : null}
        {ownerButtons}
      </section>
    );
  }

  const header =
    layout === "compact" ? (
      <div className="mb-3">
        <span className="owner-reminder-badge">Owner / Admin</span>
        <h3 className="font-display mt-2 text-lg font-semibold text-ink">Send staff email reminders</h3>
        <p className="mt-1 text-xs text-muted">Sends from the firm address (legal@hernandezlaw.info). Sign out and back in once if send fails (Gmail permission).</p>
      </div>
    ) : (
      <div className="tools-panel__section-head">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">Owner / Admin</p>
        <h2 className="font-display mt-1 text-lg font-semibold text-ink">Send staff email reminders</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Each person receives only their own due-today and overdue items. Staff emails must be in column B on the
          Employees sheet.
        </p>
      </div>
    );

  return (
    <section
      id="staff-email-reminders"
      className={`reminder-panel ${layout === "compact" ? "reminder-panel--compact mt-4 p-4" : "card tools-panel__section"} no-print`}
    >
      {header}

      {directory.length === 0 && (
        <p className="status-bar status-bar-error mb-3 text-xs">
          No active employees found. Add names and emails on the <strong>Employees</strong> sheet (columns A–D).
        </p>
      )}

      {noEmails && (
        <p className="mb-3 text-xs leading-relaxed text-amber-900">
          Add staff emails in column <strong>B</strong> on the Employees sheet so reminders can be sent.
        </p>
      )}

      {gmailReady === false && (
        <p className="status-bar status-bar-error mb-3 text-xs">
          {gmailHint ||
            'Gmail send is not active. Sign out, sign in again in a private/incognito window, and approve "Send email on your behalf".'}
        </p>
      )}

      {sendVia === "apps-script" ? (
        <p className="status-bar status-bar-warn mb-3 text-xs">
          Server is using Apps Script for mail (not your Gmail). Remove TASKS_REMINDERS_VIA_APPS_SCRIPT on Vercel or
          finish Apps Script setup.
        </p>
      ) : null}

      {gmailSender ? (
        <p className="mb-3 text-xs text-muted">
          Sends from <strong>{gmailSender}</strong> · you receive a BCC copy · staff receive column B on Employees
        </p>
      ) : null}

      <div className="tools-panel__actions">{ownerButtons}</div>

      {selectedPreview && layout === "compact" && (
        <div className="mt-4 border border-line bg-white p-3">
          <p className="text-sm font-bold text-ink">
            {selectedPreview.assignee}
            {selectedPreview.email ? (
              <span className="ml-2 font-normal text-muted">→ {selectedPreview.email}</span>
            ) : (
              <span className="ml-2 text-red-700">— no email on Employees sheet</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {selectedPreview.dueToday} due today · {selectedPreview.overdue} overdue
            {selectedPreview.overdue > 0 ? (
              <span className="block mt-1 font-bold text-red-800">
                Send overdue first — daily-only emails now include overdue automatically.
              </span>
            ) : null}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <OwnerSendButton
              label={`Email ${selectedPreview.assignee} — overdue first`}
              sub={`${selectedPreview.dueToday + selectedPreview.overdue} item${selectedPreview.dueToday + selectedPreview.overdue === 1 ? "" : "s"}`}
              disabled={!selectedPreview.canSend || busy || Boolean(sending)}
              loading={sending === `${selectedPreview.assignee}-both`}
              variant="both"
              onClick={() => sendReminder(selectedPreview.assignee, "both")}
            />
            <OwnerSendButton
              label={`Email ${selectedPreview.assignee} — today`}
              sub={`${selectedPreview.dueToday} item${selectedPreview.dueToday === 1 ? "" : "s"}`}
              disabled={!selectedPreview.canSend || busy || Boolean(sending)}
              loading={sending === `${selectedPreview.assignee}-daily`}
              variant="today"
              onClick={() => sendReminder(selectedPreview.assignee, "daily")}
            />
            <OwnerSendButton
              label={`Email ${selectedPreview.assignee} — overdue`}
              sub={`${selectedPreview.overdue} item${selectedPreview.overdue === 1 ? "" : "s"}`}
              disabled={!selectedPreview.canSend || busy || Boolean(sending) || selectedPreview.overdue === 0}
              loading={sending === `${selectedPreview.assignee}-overdue`}
              variant="overdue"
              onClick={() => sendReminder(selectedPreview.assignee, "overdue")}
            />
          </div>
        </div>
      )}

      {layout === "full" && (
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="reminder-panel__table firm-ledger-table firm-ledger-table--responsive-stack w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-cream/80 text-[10px] font-extrabold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2 text-center">Today</th>
                <th className="px-3 py-2 text-center">Overdue</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((row) => (
                <tr key={row.assignee} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 font-bold text-ink" data-label="Staff">{row.assignee}</td>
                  <td className="px-3 py-2 text-muted" data-label="Email">{row.email || "—"}</td>
                  <td className="px-3 py-2 text-center font-semibold" data-label="Today">{row.dueToday}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${row.overdue > 0 ? "text-red-700" : ""}`} data-label="Overdue">
                    {row.overdue}
                  </td>
                  <td className="px-3 py-2" data-label="Actions">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        disabled={!row.canSend || busy || Boolean(sending)}
                        className="owner-reminder-mini-btn"
                        onClick={() => sendReminder(row.assignee, "both")}
                      >
                        {sending === `${row.assignee}-both` ? "…" : "Both"}
                      </button>
                      <button
                        type="button"
                        disabled={!row.canSend || busy || Boolean(sending)}
                        className="owner-reminder-mini-btn"
                        onClick={() => sendReminder(row.assignee, "daily")}
                      >
                        {sending === `${row.assignee}-daily` ? "…" : "Today"}
                      </button>
                      <button
                        type="button"
                        disabled={!row.canSend || busy || Boolean(sending)}
                        className="owner-reminder-mini-btn owner-reminder-mini-btn--overdue"
                        onClick={() => sendReminder(row.assignee, "overdue")}
                      >
                        {sending === `${row.assignee}-overdue` ? "…" : "Overdue"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OwnerSendButton({
  label,
  sub,
  disabled,
  loading,
  variant,
  onClick
}: {
  label: string;
  sub: string;
  disabled: boolean;
  loading: boolean;
  variant: "today" | "overdue" | "both" | "test";
  onClick: () => void;
}) {
  const variantClass =
    variant === "overdue"
      ? "owner-reminder-btn--overdue"
      : variant === "both"
        ? "owner-reminder-btn--both"
        : variant === "test"
          ? "owner-reminder-btn--test"
          : "owner-reminder-btn--today";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`owner-reminder-btn ${variantClass}`}
    >
      <span className="owner-reminder-btn__label">{loading ? "Sending…" : label}</span>
      <span className="owner-reminder-btn__sub">{sub}</span>
    </button>
  );
}
