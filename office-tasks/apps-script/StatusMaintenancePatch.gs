/**
 * Patch for Law Office Task + Calendar V2 (Code.gs)
 *
 * Problem: refreshAllOverviews / daily maintenance sets Status to "Overdue" for
 * past-due rows, which overwrites "Waiting" and "Started" set from the web app.
 *
 * Add these helpers to Code.gs, then use shouldPreserveTaskStatus_() anywhere
 * you auto-set Status from due dates.
 */

function normalizeStatusText_(value) {
  return String(value || "")
    .trim()
    .replace(/^'+/, "")
    .toLowerCase();
}

/** Do not auto-change these — staff chose them deliberately. */
function shouldPreserveTaskStatus_(status) {
  var s = normalizeStatusText_(status);
  return (
    s === "waiting" ||
    s === "started" ||
    s === "done" ||
    s === "cancelled" ||
    s === "reset"
  );
}

function shouldPreserveEventStatus_(status) {
  var s = normalizeStatusText_(status);
  return (
    s === "waiting" ||
    s === "started" ||
    s === "done" ||
    s === "submitted" ||
    s === "cancelled" ||
    s === "reset"
  );
}

/**
 * Example — inside your refresh row loop, BEFORE writing Overdue:
 *
 *   var current = sheet.getRange(row, STATUS_COL).getDisplayValue();
 *   if (shouldPreserveTaskStatus_(current)) continue;
 *   if (dueDate < today && !done) {
 *     sheet.getRange(row, STATUS_COL).setValue("Overdue");
 *   }
 *
 * Also add "Waiting" and "Started" to the Status column data validation list
 * (Task System → Setup / Repair Workbook, or Data → Data validation in Sheets).
 */
