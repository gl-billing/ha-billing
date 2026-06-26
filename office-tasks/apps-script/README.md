# Apps Script for HA Office Tasks

## Files in this project

| File | Purpose |
|------|---------|
| **Code.gs** | Your full **Law Office Task + Calendar V2** script (paste from your spreadsheet or the version you shared with Cursor) |
| **WebAppApi.gs** | HTTP bridge for `tasks-web` (refresh overviews, reminders, calendar sync) |
| **StaffReminders.gs** | Per-staff email reminders (due today / overdue) from the web app |

## Setup

1. Open your **tasks** Google Spreadsheet → Extensions → Apps Script.
2. Replace/create **Code.gs** with your V2 script.
3. Add **WebAppApi.gs** and **StaffReminders.gs** from this folder.
4. **Project settings → Script properties** → add `WEB_APP_SECRET` (long random string).
5. Save → Run `setupLawOfficeSystem` once from the sheet menu **Task System → Setup / Repair Workbook**.
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (token protects actions)
7. Copy deployment URL → `TASKS_APPS_SCRIPT_WEB_APP_URL` in `tasks-web/.env.local`.
8. Copy the same secret → `TASKS_APPS_SCRIPT_WEB_APP_SECRET`.

## Reminder email bug fix

In `sendReminderEmails_`, remove the **duplicate block** after the `assignees.forEach` loop (the second block that references `email` without defining it). Only the loop that builds `grouped[email]` should remain. Otherwise reminders may error at runtime.

## Staff reminder emails (web app)

**Employees** sheet columns: **A** Name · **B** Email · **C** Role · **D** Active (`TRUE`/`FALSE`).

From **Team** or **Tools** (admin only), send:

- **Today only** — open items due today  
- **Overdue only** — past due, still open  
- **Full** — both sections in one email  

Redeploy the Web App after adding `StaffReminders.gs`.

## Waiting / Started status

The web app stores a hidden marker `GL_FOLLOW_UP:Waiting` or `GL_FOLLOW_UP:Started` in the **Remarks** column so follow-up tasks stay out of Overdue even if sheet scripts reset Status.

**Recommended:** merge **StatusMaintenancePatch.gs** into **Code.gs** so `refreshAllOverviews` skips Waiting/Started rows (see comments in that file).

Also ensure Status data validation includes **Waiting** and **Started**.

## Menu vs web

- **Sidebar / sheet menu** — still works in the spreadsheet.
- **tasks-web** — reads/writes **Master Tasks** and **Hearings & Events**; calls Web App for heavy jobs.
