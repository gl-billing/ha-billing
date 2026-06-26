/**
 * HA Billing — Web App API bridge
 * Paste into your Apps Script project (new file: WebAppApi.gs).
 * Deploy: Deploy → New deployment → Web app
 *   - Execute as: Me
 *   - Who has access: Anyone (or Anyone with Google account — match your security needs)
 * Set APPS_SCRIPT_WEB_APP_URL in the web app .env to the deployment URL.
 */

function doGet(e) {
  return handleWebAppRequest_(e);
}

function doPost(e) {
  return handleWebAppRequest_(e);
}

function handleWebAppRequest_(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const params = e && e.parameter ? e.parameter : {};
    const body = parseWebAppBody_(e);
    const action = String(params.action || body.action || "").trim();
    const token = String(params.token || body.token || "").trim();
    const expected = String(getSettingValue("Web App Secret", "") || "").trim();

    if (!expected) {
      return jsonResponse_({ ok: false, error: "Web App Secret is not configured in Settings." }, 503);
    }

    if (!token || token !== expected) {
      return jsonResponse_({ ok: false, error: "Unauthorized." }, 401);
    }

    switch (action) {
      case "ping":
        return jsonResponse_({ ok: true, service: "HA Billing Web API", user: Session.getActiveUser().getEmail() });
      case "generateSOA":
        generateAndSendSheetSOA(String(body.clientCode || params.clientCode || ""));
        return jsonResponse_({ ok: true, message: "SOA flow completed." });
      case "generateAR":
        generateAndSendAcknowledgmentReceipt(String(body.clientCode || params.clientCode || ""));
        return jsonResponse_({ ok: true, message: "AR flow completed." });
      case "refreshDashboard":
        refreshDashboard();
        return jsonResponse_({ ok: true, message: "Dashboard refreshed." });
      case "generateSOAHeadless":
        return jsonResponse_(generateSOAHeadless_(String(body.clientCode || params.clientCode || ""), {
          statusReport: body.statusReport,
          deliveryAction: body.deliveryAction,
          preferredGreeting: body.preferredGreeting || ""
        }));
      case "generateARHeadless":
        return jsonResponse_(generateARHeadless_(String(body.clientCode || params.clientCode || ""), {
          sheetRow: body.sheetRow,
          method: body.method,
          details: body.details,
          description: body.description,
          extraNote: body.extraNote,
          deliveryAction: body.deliveryAction
        }));
      case "generateNotarialReceiptHeadless":
        return jsonResponse_(generateNotarialReceiptHeadless_({
          receiptNo: body.receiptNo || params.receiptNo || "",
          date: body.date || "",
          name: body.name || "",
          address: body.address || "",
          documentType: body.documentType || "",
          docNo: body.docNo || "",
          pageNo: body.pageNo || "",
          bookNo: body.bookNo || "",
          series: body.series || "",
          amount: body.amount || 0,
          paymentMethod: body.paymentMethod || "",
          paymentDetails: body.paymentDetails || ""
        }));
      case "batchGenerateSOAHeadless":
        return jsonResponse_(batchGenerateSOAHeadless_(body.clientCodes || [], body.deliveryAction));
      case "setupAutoRefreshTrigger":
        return jsonResponse_(setupAutoRefreshTrigger_());
      case "backupSpreadsheet":
        return jsonResponse_(backupSpreadsheet_());
      case "getArFolderHeadless":
        return jsonResponse_(getArFolderHeadless_());
      case "getNrFolderHeadless":
        return jsonResponse_(getNrFolderHeadless_());
      default:
        return jsonResponse_({ ok: false, error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

function parseWebAppBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function jsonResponse_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
