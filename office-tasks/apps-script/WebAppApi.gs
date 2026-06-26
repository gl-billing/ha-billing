/**
 * HA Office Tasks — Web App API bridge (add alongside your Code.gs)
 * Deploy: Execute as Me, Who has access: Anyone
 * Set Script property WEB_APP_SECRET (Project settings → Script properties)
 * Match TASKS_APPS_SCRIPT_WEB_APP_SECRET in tasks-web .env
 */

function doGet(e) {
  return handleTasksWebAppRequest_(e);
}

function doPost(e) {
  return handleTasksWebAppRequest_(e);
}

function handleTasksWebAppRequest_(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const params = e && e.parameter ? e.parameter : {};
    const body = parseTasksWebAppBody_(e);
    const action = String(params.action || body.action || "").trim();
    const token = String(params.token || body.token || "").trim();
    const expected = String(getTasksWebAppSecret_() || "").trim();

    if (!expected) {
      return tasksJsonResponse_({ ok: false, error: "WEB_APP_SECRET script property is not set." }, 503);
    }

    if (!token || token !== expected) {
      return tasksJsonResponse_({ ok: false, error: "Unauthorized." }, 401);
    }

    switch (action) {
      case "ping":
        return tasksJsonResponse_({
          ok: true,
          service: "HA Office Tasks Web API",
          user: Session.getActiveUser().getEmail()
        });
      case "refreshAllOverviews":
        refreshAllOverviews({ silent: true });
        return tasksJsonResponse_({ ok: true, message: "All overviews refreshed." });
      case "sendRemindersNow":
        if (typeof sendRemindersNow === "function") {
          sendRemindersNow();
          return tasksJsonResponse_({ ok: true, message: "Reminder emails sent (check Reminders Log)." });
        }
        return sendAllStaffRemindersFromWeb_("both");
      case "sendStaffReminder": {
        var assignee = String(body.assignee || params.assignee || "").trim();
        var scope = String(body.scope || params.scope || "both").trim();
        if (["daily", "overdue", "both"].indexOf(scope) === -1) {
          return tasksJsonResponse_({ ok: false, error: "Invalid scope. Use daily, overdue, or both." }, 400);
        }
        var staffResult = sendStaffReminderFromWeb_(assignee, scope);
        return tasksJsonResponse_(staffResult, staffResult.ok ? 200 : 400);
      }
      case "sendAllStaffReminders": {
        var allScope = String(body.scope || params.scope || "both").trim();
        if (["daily", "overdue", "both"].indexOf(allScope) === -1) {
          return tasksJsonResponse_({ ok: false, error: "Invalid scope. Use daily, overdue, or both." }, 400);
        }
        var allResult = sendAllStaffRemindersFromWeb_(allScope);
        return tasksJsonResponse_(allResult);
      }
      case "syncUpcomingCalendar":
        syncUpcomingToGoogleCalendar({ silent: true });
        return tasksJsonResponse_({ ok: true, message: "Checked upcoming items synced to Google Calendar." });
      case "syncAllOpenCalendar":
        syncAllOpenItemsToGoogleCalendar({ silent: true });
        return tasksJsonResponse_({ ok: true, message: "All open dated items synced to Google Calendar." });
      case "sendStaleFollowUpNudges":
        // Stale Waiting/Started items are included in sendAllStaffReminders emails.
        return sendAllStaffRemindersFromWeb_("both");
      case "sendHearingReminders":
        if (typeof sendHearingRemindersFromWeb_ === "function") {
          return tasksJsonResponse_(sendHearingRemindersFromWeb_(body));
        }
        return tasksJsonResponse_({
          ok: true,
          message: "Hearing reminders: deploy HearingReminders.gs or use Tools → Hearing reminders in the web app."
        });
      case "seedBirDeadlines":
        if (typeof seedBirDeadlinesFromWeb_ === "function") {
          return tasksJsonResponse_(seedBirDeadlinesFromWeb_(body));
        }
        return tasksJsonResponse_({
          ok: true,
          message: "BIR seed: use Tools → BIR tracker → Seed upcoming deadlines in the web app, or set CRON_GOOGLE_ACCESS_TOKEN on Vercel."
        });
      default:
        return tasksJsonResponse_({ ok: false, error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return tasksJsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

function getTasksWebAppSecret_() {
  return PropertiesService.getScriptProperties().getProperty("WEB_APP_SECRET");
}

function parseTasksWebAppBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function tasksJsonResponse_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    // Apps Script Web App cannot set HTTP status; client checks ok flag
  }
  return output;
}
