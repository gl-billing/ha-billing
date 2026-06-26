/**
 * Per-staff reminder emails for tasks-web (add alongside Code.gs + WebAppApi.gs)
 * Employees sheet: A Name | B Email | C Role | D Active
 */

var TASKS_SHEET_NAME_ = "Master Tasks";
var EVENTS_SHEET_NAME_ = "Hearings & Events";
var EMPLOYEES_SHEET_NAME_ = "Employees";
var REMINDERS_LOG_SHEET_ = "Reminders Log";
var OFFICE_TZ_ = "Asia/Manila";

function sendStaffReminderFromWeb_(assigneeName, scope) {
  var name = String(assigneeName || "").trim();
  if (!name) {
    return { ok: false, error: "Assignee name is required." };
  }
  var employees = loadActiveEmployees_();
  var emp = findEmployeeByName_(employees, name);
  if (!emp) {
    return { ok: false, error: "No active employee found with name: " + name };
  }
  if (!emp.email) {
    return { ok: false, error: "No email on Employees sheet for: " + name };
  }
  var today = todayYmdInTz_(OFFICE_TZ_);
  var items = collectOpenItemsForAssignee_(name, today);
  var groups = groupItemsForReminder_(items, today);
  var sendDaily = scope === "daily" || scope === "both";
  var sendOverdue = scope === "overdue" || scope === "both";
  if (scope === "daily" && groups.overdue.length > 0) {
    sendOverdue = true;
  }
  var skip = false;
  if (sendDaily && sendOverdue) {
    skip = !groups.dueToday.length && !groups.overdue.length;
  } else if (sendDaily) {
    skip = !groups.dueToday.length;
  } else if (sendOverdue) {
    skip = !groups.overdue.length;
  }
  if (skip) {
    return {
      ok: true,
      message: "No " + scope + " items for " + name + " — email skipped.",
      skipped: true
    };
  }
  var subject = buildStaffReminderSubject_(name, groups, sendDaily, sendOverdue);
  var html = buildStaffReminderHtml_(name, groups, today, sendDaily, sendOverdue);
  GmailApp.sendEmail(emp.email, subject, stripHtml_(html), {
    htmlBody: html,
    name: "HA Office Tasks"
  });
  logReminderSent_(name, emp.email, scope, groups.dueToday.length, groups.overdue.length);
  return {
    ok: true,
    message: "Reminder sent to " + name + " (" + emp.email + ").",
    dueToday: groups.dueToday.length,
    overdue: groups.overdue.length
  };
}

function sendAllStaffRemindersFromWeb_(scope) {
  var employees = loadActiveEmployees_();
  var sent = 0;
  var skipped = 0;
  var errors = [];
  employees.forEach(function (emp) {
    if (!emp.email) {
      errors.push(emp.name + " (no email)");
      return;
    }
    try {
      var result = sendStaffReminderFromWeb_(emp.name, scope);
      if (result.ok && result.skipped) skipped++;
      else if (result.ok) sent++;
      else errors.push(emp.name + ": " + result.error);
    } catch (e) {
      errors.push(emp.name + ": " + (e && e.message ? e.message : String(e)));
    }
  });
  var msg = "Sent " + sent + " reminder(s)";
  if (skipped) msg += ", skipped " + skipped + " (nothing to send)";
  if (errors.length) msg += ". Issues: " + errors.join("; ");
  return { ok: true, message: msg, sent: sent, skipped: skipped, errors: errors };
}

function loadActiveEmployees_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME_);
  if (!sheet) return [];
  var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow(), 2), 4).getValues();
  var list = [];
  rows.forEach(function (row) {
    var name = String(row[0] || "").trim();
    var email = String(row[1] || "").trim();
    var active = String(row[3] || "").toUpperCase() !== "FALSE";
    if (name && active) list.push({ name: name, email: email });
  });
  return list;
}

function findEmployeeByName_(employees, name) {
  var target = name.toLowerCase();
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].name.toLowerCase() === target) return employees[i];
  }
  return null;
}

function collectOpenItemsForAssignee_(assigneeName, today) {
  var items = [];
  items = items.concat(readTaskRowsForAssignee_(assigneeName));
  items = items.concat(readEventRowsForAssignee_(assigneeName));
  return items.filter(function (item) {
    return item.open && item.date;
  });
}

function readTaskRowsForAssignee_(assigneeName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET_NAME_);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow(), 14).getValues();
  var out = [];
  rows.forEach(function (row) {
    if (isRowBlank_(row)) return;
    var assigned = String(row[4] || "");
    if (!assigneeMatches_(assigned, assigneeName)) return;
    var status = String(row[10] || "");
    if (isCancelled_(status)) return;
    var done = row[11] === true || String(row[11]).toUpperCase() === "TRUE" || status === "Done";
    out.push({
      source: "Task",
      id: String(row[0] || ""),
      date: formatDateCell_(row[2]),
      clientCase: String(row[5] || ""),
      category: String(row[6] || "Task"),
      priority: String(row[3] || ""),
      details: String(row[7] || ""),
      nextAction: String(row[9] || ""),
      status: status,
      open: !done
    });
  });
  return out;
}

function readEventRowsForAssignee_(assigneeName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET_NAME_);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow(), 18).getValues();
  var out = [];
  rows.forEach(function (row) {
    if (isRowBlank_(row)) return;
    var assigned = String(row[7] || "");
    if (!assigneeMatches_(assigned, assigneeName)) return;
    var status = String(row[13] || "");
    if (isCancelled_(status)) return;
    var done = row[14] === true || String(row[14]).toUpperCase() === "TRUE" || status === "Done" || status === "Submitted";
    var eventDate = formatDateCell_(row[2]);
    var filing = formatDateCell_(row[16]);
    out.push({
      source: "Event",
      id: String(row[0] || ""),
      date: eventDate || filing,
      clientCase: String(row[8] || ""),
      category: String(row[5] || "Event"),
      priority: String(row[6] || ""),
      details: String(row[10] || ""),
      nextAction: String(row[12] || ""),
      venue: String(row[9] || ""),
      status: status,
      open: !done
    });
  });
  return out;
}

function groupItemsForReminder_(items, today) {
  var dueToday = [];
  var overdue = [];
  items.forEach(function (item) {
    if (!item.open || !item.date) return;
    if (item.date < today) overdue.push(item);
    else if (item.date === today) dueToday.push(item);
  });
  sortReminderItems_(dueToday);
  sortReminderItems_(overdue);
  return { dueToday: dueToday, overdue: overdue };
}

function sortReminderItems_(list) {
  list.sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date)) || String(a.clientCase).localeCompare(String(b.clientCase));
  });
}

function buildStaffReminderSubject_(name, groups, sendDaily, sendOverdue) {
  var parts = [];
  if (sendDaily && groups.dueToday.length) parts.push(groups.dueToday.length + " due today");
  if (sendOverdue && groups.overdue.length) parts.push(groups.overdue.length + " overdue");
  var summary = parts.length ? parts.join(", ") : "Office tasks";
  return "HA Office — " + summary + " · " + name;
}

function buildStaffReminderHtml_(name, groups, today, sendDaily, sendOverdue) {
  var html = [
    '<div style="font-family:Georgia,serif;max-width:640px;color:#161411;">',
    '<p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9f7a22;margin:0 0 8px;">Hernandez &amp; Associates</p>',
    '<h2 style="margin:0 0 8px;font-size:22px;">Hello, ' + escapeHtml_(name) + "</h2>",
    '<p style="margin:0 0 16px;color:#756d63;font-size:14px;">Your task summary for <strong>' + escapeHtml_(today) + "</strong>.</p>"
  ];
  if (sendOverdue && groups.overdue.length) {
    html.push('<h3 style="color:#b91c1c;font-size:14px;margin:24px 0 8px;">Fix first — overdue</h3>');
    html.push(renderItemListHtml_(groups.overdue));
  }
  if (sendDaily && groups.dueToday.length) {
    html.push('<h3 style="color:#1f5f3b;font-size:14px;margin:24px 0 8px;">Due today</h3>');
    html.push(renderItemListHtml_(groups.dueToday));
  }
  if ((!sendDaily || !groups.dueToday.length) && (!sendOverdue || !groups.overdue.length)) {
    html.push('<p style="color:#756d63;">No open items in this reminder.</p>');
  }
  html.push(
    '<p style="margin-top:24px;font-size:12px;color:#756d63;">Open the office task sheet or web app to mark items done.</p>',
    "</div>"
  );
  return html.join("");
}

function renderItemListHtml_(items) {
  var rows = items.map(function (item) {
    return (
      '<li style="margin-bottom:10px;font-size:13px;line-height:1.45;">' +
      "<strong>" +
      escapeHtml_(item.clientCase || "—") +
      "</strong> · " +
      escapeHtml_(item.date) +
      " · " +
      escapeHtml_(item.category) +
      (item.priority ? " · " + escapeHtml_(item.priority) : "") +
      (item.details ? "<br/><span style=\"color:#756d63;\">" + escapeHtml_(item.details) + "</span>" : "") +
      (item.nextAction ? "<br/><span style=\"color:#1f5f3b;\">Next: " + escapeHtml_(item.nextAction) + "</span>" : "") +
      "</li>"
    );
  });
  return '<ul style="padding-left:18px;margin:0;">' + rows.join("") + "</ul>";
}

function logReminderSent_(name, email, scope, dueTodayCount, overdueCount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(REMINDERS_LOG_SHEET_);
    if (!sheet) return;
    sheet.appendRow([new Date(), name, email, scope, dueTodayCount, overdueCount, "Web app"]);
  } catch (e) {
    // optional log sheet
  }
}

function assigneeMatches_(assignedCell, name) {
  var target = name.toLowerCase();
  return String(assignedCell || "")
    .split(/[,;]+/)
    .map(function (s) {
      return s.trim().toLowerCase();
    })
    .some(function (a) {
      return a === target;
    });
}

function isCancelled_(status) {
  var s = String(status || "").trim();
  return s === "Cancelled" || s === "Reset";
}

function isRowBlank_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== "" && row[i] !== null && row[i] !== undefined && row[i] !== false) return false;
  }
  return true;
}

function formatDateCell_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, OFFICE_TZ_, "yyyy-MM-dd");
  }
  var d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, OFFICE_TZ_, "yyyy-MM-dd");
}

function todayYmdInTz_(tz) {
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}

function escapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml_(html) {
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
