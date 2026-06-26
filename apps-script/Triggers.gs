/**
 * HA Billing — Triggers & batch operations
 * Paste into Apps Script alongside WebAppApi.gs and WebAppHeadless.gs
 */

function batchGenerateSOAHeadless_(clientCodes, deliveryAction) {
  var codes = Array.isArray(clientCodes) ? clientCodes : [];
  var action = deliveryAction || "Send Now";
  var results = [];
  var okCount = 0;

  for (var i = 0; i < codes.length; i++) {
    var code = String(codes[i] || "").trim();
    if (!code) continue;

    try {
      var result = generateSOAHeadless_(code, {
        statusReport: null,
        deliveryAction: action
      });
      results.push({
        clientCode: code,
        ok: true,
        message: result && result.message ? result.message : "SOA completed."
      });
      okCount++;
    } catch (err) {
      results.push({
        clientCode: code,
        ok: false,
        error: err && err.message ? err.message : String(err)
      });
    }

    // Avoid Gmail / Drive rate limits between clients
    if (i < codes.length - 1) {
      Utilities.sleep(1500);
    }
  }

  return {
    ok: okCount > 0,
    message: "Batch SOA: " + okCount + " of " + codes.length + " completed.",
    results: results
  };
}

function setupAutoRefreshTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onHourlyDashboardRefresh_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("onHourlyDashboardRefresh_")
    .timeBased()
    .everyHours(1)
    .create();

  return {
    ok: true,
    message: "Hourly dashboard refresh trigger installed."
  };
}

function onHourlyDashboardRefresh_() {
  refreshDashboard();
}

function backupSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var file = DriveApp.getFileById(ss.getId());
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
  var copyName = ss.getName() + " Backup " + stamp;

  var backupFolder = getOrCreateBackupFolder_();
  var copy = file.makeCopy(copyName, backupFolder);

  return {
    ok: true,
    message: "Backup created: " + copyName,
    fileId: copy.getId(),
    fileUrl: copy.getUrl()
  };
}

function getOrCreateBackupFolder_() {
  var folderName = "HA Billing Backups";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var parentFolders = DriveApp.getFileById(ss.getId()).getParents();

  if (!parentFolders.hasNext()) {
    return DriveApp.createFolder(folderName);
  }

  var parent = parentFolders.next();
  var folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(folderName);
}

/**
 * Run once manually from Apps Script editor to install hourly refresh:
 *   setupAutoRefreshTrigger_()
 */
function installHourlyDashboardRefresh() {
  return setupAutoRefreshTrigger_();
}

/**
 * Run once from the Apps Script editor to grant Gmail access for SOA/AR email.
 * Use the same Google account as Web app deploy (Execute as: Me).
 */
function authorizeGmailForWebApp() {
  var activeEmail = Session.getActiveUser().getEmail();
  var aliases = GmailApp.getAliases();
  var firmEmail = typeof getFirmSenderEmail_ === "function" ? getFirmSenderEmail_() : "info@hernandezassociates.com";
  var allowed = typeof getGmailSendAsAddresses_ === "function" ? getGmailSendAsAddresses_() : [activeEmail].concat(aliases || []);
  var normalizedFirm = String(firmEmail || "").trim().toLowerCase();
  var canSendAs = false;

  for (var i = 0; i < allowed.length; i++) {
    if (String(allowed[i] || "").trim().toLowerCase() === normalizedFirm) {
      canSendAs = true;
      break;
    }
  }

  if (!canSendAs) {
    throw new Error(
      typeof firmSendAsSetupMessage_ === "function"
        ? firmSendAsSetupMessage_(firmEmail, activeEmail, allowed)
        : "Add Send mail as for " + firmEmail + " in Gmail for " + activeEmail + ", then redeploy the Web App."
    );
  }

  return {
    ok: true,
    message:
      "Gmail authorized for " +
      activeEmail +
      " (can send as " +
      firmEmail +
      "). Deploy → Manage deployments → New version → Deploy, then retry SOA/AR."
  };
}
