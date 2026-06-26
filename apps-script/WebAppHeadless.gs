/**
 * HA Billing — Headless SOA / AR for web app (no Spreadsheet UI prompts)
 * Paste into Apps Script AFTER code.gs, then update WebAppApi.gs switch cases.
 * Redeploy Web App after changes.
 */

/** Preferred Greeting column on Master List (1-based). Keep in sync with gl-config.ts masterHeaders. */
var MASTER_PREFERRED_GREETING_COL = 20;

/** Web app only — never treat API action names (e.g. generateSOAHeadless) as delivery mode. */
function resolveDeliveryAction_(options) {
  const raw = String((options && options.deliveryAction) || "").trim();
  if (raw === "Create Gmail Draft") return "Create Gmail Draft";
  return "Send Now";
}

function resolveClientGreeting_(ctx, options) {
  var override = options && options.preferredGreeting ? String(options.preferredGreeting).trim() : "";
  if (override) return override;

  try {
    if (ctx && ctx.sheetRow) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var master = ss.getSheetByName(GL.sheets.master);
      if (master) {
        var stored = String(master.getRange(ctx.sheetRow, MASTER_PREFERRED_GREETING_COL).getValue() || "").trim();
        if (stored) return stored;
      }
    }
  } catch (e) {}

  if (ctx && ctx.preferredGreeting && String(ctx.preferredGreeting).trim()) {
    return String(ctx.preferredGreeting).trim();
  }

  var name = String((ctx && ctx.clientName) || "Client").trim();
  var parts = name.split(/\s+/);
  return parts[0] || "Client";
}

function withPreferredGreetingEmailBody_(plainBody, ctx, options) {
  var greeting = resolveClientGreeting_(ctx, options);
  var lines = String(plainBody || "").split("\n");
  if (lines.length && /^Dear Sir\/Ma'am /i.test(lines[0])) {
    lines[0] = "Dear Sir/Ma'am " + greeting;
    return lines.join("\n");
  }
  return plainBody;
}

/** Official firm outbound address — override via Settings "Firm Email" if needed. */
function getFirmSenderEmail_() {
  var keys = ["Firm Email", "Sender Email", "Billing From Email"];
  for (var i = 0; i < keys.length; i++) {
    var value = String(getSettingValue(keys[i], "") || "").trim();
    if (value && value.indexOf("@") > 0) return value;
  }
  return "info@hernandezassociates.com";
}

function normalizeEmailForSendAs_(raw) {
  var value = String(raw || "").trim().toLowerCase();
  var match = value.match(/<([^>]+)>/);
  return match ? match[1].trim() : value;
}

function getGmailSendAsAddresses_() {
  var seen = {};
  var list = [];

  function add_(raw) {
    var email = normalizeEmailForSendAs_(raw);
    if (!email || email.indexOf("@") < 1 || seen[email]) return;
    seen[email] = true;
    list.push(email);
  }

  try {
    add_(Session.getActiveUser().getEmail());
  } catch (e) {}

  try {
    var aliases = GmailApp.getAliases();
    for (var i = 0; i < aliases.length; i++) {
      add_(aliases[i]);
    }
  } catch (e) {}

  return list;
}

function firmSendAsSetupMessage_(firmEmail, activeEmail, allowed) {
  var allowedText = allowed.length ? allowed.join(", ") : "(none)";
  return (
    "Gmail cannot send as " +
    firmEmail +
    " from " +
    (activeEmail || "the Apps Script deployer account") +
    ". In Gmail for that account, go to Settings → Accounts → Send mail as and add " +
    firmEmail +
    " (or redeploy the Web App while signed in as a Google account that already has Send mail as for " +
    firmEmail +
    "). Current send-as addresses: " +
    allowedText +
    "."
  );
}

function getFirmFromOptions_() {
  var firmEmail = normalizeEmailForSendAs_(getFirmSenderEmail_());
  var allowed = getGmailSendAsAddresses_();
  var canSendAs = false;

  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] === firmEmail) {
      canSendAs = true;
      break;
    }
  }

  if (!canSendAs) {
    var activeEmail = "";
    try {
      activeEmail = Session.getActiveUser().getEmail();
    } catch (e) {}
    throw new Error(firmSendAsSetupMessage_(firmEmail, activeEmail, allowed));
  }

  return {
    name: getFirmSenderName_(),
    from: firmEmail
  };
}

function sendBillingEmailHeadless_(recipient, subject, plainBody, htmlBody, pdfBlob) {
  var opts = getFirmFromOptions_();
  opts.htmlBody = htmlBody;
  opts.inlineImages = getInlineImages_();
  opts.attachments = pdfBlob ? [pdfBlob] : [];
  GmailApp.sendEmail(recipient, subject, plainBody, opts);
}

function generateSOAHeadless_(clientCode, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(GL.sheets.master);
  const settings = getSettingsMap_();
  let tempSheet = null;
  const targetClient = sanitizeSheetName_(clientCode);
  const action = resolveDeliveryAction_(options);

  if (!targetClient) throw new Error("Client code is required.");

  try {
    const ctx = getClientContext_(targetClient);
    if (!ctx) throw new Error("Client not found. Please check the client code and Master List.");

    const clientSheet = ss.getSheetByName(targetClient);
    const templateSheet = ss.getSheetByName(GL.sheets.invoice);

    if (!clientSheet) throw new Error("Client tab not found.");
    if (!templateSheet) throw new Error("Could not find the Invoice tab.");

    const statusReport = options && Object.prototype.hasOwnProperty.call(options, "statusReport")
      ? options.statusReport
      : null;

    const ledgerData = getLedgerData_(clientSheet, 7).filter(function(row) { return row[0] !== ""; });
    const today = new Date();
    const todayStr = formatDateLong_(today);
    const periodStartStr = ledgerData.length ? formatDateLong_(ledgerData[0][0]) : todayStr;
    const totalDue = Number(clientSheet.getRange("E1").getValue()) || 0;
    const invoiceNum = getNextDocumentNumber("INV", targetClient);

    tempSheet = templateSheet.copyTo(ss).setName(makeTempSheetName_("TEMP_SOA", targetClient));
    tempSheet.showSheet();
    removeSheetProtections_(tempSheet);

    replaceTags_(tempSheet, {
      "{{CLIENT_NAME}}": ctx.clientName,
      "{{CLIENT_ADDRESS}}": ctx.clientAddress,
      "{{CLIENT_PHONE}}": ctx.clientPhone,
      "{{CASE_TITLE}}": ctx.caseTitle,
      "{{CASE_NUMBER}}": ctx.caseNumber,
      "{{INVOICE_DATE}}": todayStr,
      "{{INVOICE_NUMBER}}": invoiceNum,
      "{{PERIOD}}": periodStartStr + " - " + todayStr,
      "{{PREV_BALANCE}}": formatPeso_(ctx.prevBalance),
      "{{NEW_CHARGES}}": formatPeso_(clientSheet.getRange("E3").getValue()),
      "{{PAYMENTS}}": formatPeso_(clientSheet.getRange("E2").getValue()),
      "{{TOTAL_DUE}}": formatPeso_(clientSheet.getRange("E1").getValue())
    });

    fillLedgerMarker_(tempSheet, ledgerData);
    SpreadsheetApp.flush();

    const pdfBlob = exportSheetToPdf_(ss, tempSheet, invoiceNum + "_" + targetClient + "_SOA.pdf", {
      size: "A4",
      portrait: true,
      fitw: true,
      scale: 4,
      top_margin: 0.25,
      bottom_margin: 0.25,
      left_margin: 0.25,
      right_margin: 0.25,
      horizontal_alignment: "CENTER",
      vertical_alignment: "TOP",
      r1: 0,
      c1: 0,
      r2: getExportLastRow_(tempSheet),
      c2: getExportLastColumn_(tempSheet)
    });

    const emailBody = buildBillingSoaEmailPlain_(ctx, invoiceNum, totalDue, statusReport, options);
    const htmlBody = buildBillingSoaEmailHtml_(ctx, invoiceNum, totalDue, statusReport, options);
    const subject = "Statement of Account: " + invoiceNum + " - " + targetClient;
    const savedFile = getOrCreateBillingFolder(GL.folders.soa).createFile(pdfBlob);

    if (action === "Send Now") {
      sendBillingEmailHeadless_(ctx.email, subject, emailBody, htmlBody, pdfBlob);
      masterSheet.getRange(ctx.sheetRow, 13).setValue(today);
    } else {
      var draftOpts = getFirmFromOptions_();
      draftOpts.htmlBody = htmlBody;
      draftOpts.inlineImages = getInlineImages_();
      draftOpts.attachments = [pdfBlob];
      GmailApp.createDraft(ctx.email, subject, emailBody, draftOpts);
    }

    masterSheet.getRange(ctx.sheetRow, 8).setValue(today);
    masterSheet.getRange(ctx.sheetRow, 14).setValue(invoiceNum);
    setPdfLink_(masterSheet.getRange(ctx.sheetRow, 15), savedFile.getUrl(), "View SOA");
    masterSheet.getRange(ctx.sheetRow, 19).setValue(addDays_(today, Number(settings["Default Due Days"]) || 7));

    logDocument_({
      clientCode: targetClient,
      clientName: ctx.clientName,
      type: "SOA",
      number: invoiceNum,
      amount: totalDue,
      email: ctx.email,
      url: savedFile.getUrl(),
      status: action === "Send Now" ? "Sent" : "Draft Created"
    });

    updateSingleClientStatus_(targetClient);

    return {
      ok: true,
      message: action === "Send Now"
        ? "SOA sent to " + ctx.email + "."
        : "SOA Gmail draft created for " + ctx.email + ".",
      invoiceNumber: invoiceNum
    };
  } finally {
    if (tempSheet) safeDeleteSheet_(tempSheet, GL.sheets.master);
  }
}

function generateARHeadless_(clientCode, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tempSheet = null;
  const targetClient = sanitizeSheetName_(clientCode);
  const action = resolveDeliveryAction_(options);

  if (!targetClient) throw new Error("Client code is required.");
  if (!options || !options.sheetRow) throw new Error("Payment row is required.");

  try {
    const ctx = getClientContext_(targetClient);
    if (!ctx) throw new Error("Client not found in Master List.");

    const clientSheet = ss.getSheetByName(targetClient);
    const templateSheet = ss.getSheetByName(GL.sheets.receipt);
    if (!clientSheet) throw new Error("Client tab not found.");
    if (!templateSheet) throw new Error("Could not find the Acknowledgment Receipt tab.");

    const sheetRow = Number(options.sheetRow);
    const rowValues = clientSheet.getRange(sheetRow, 1, sheetRow, 12).getValues()[0];
    const paymentChoice = {
      sheetRow: sheetRow,
      alreadyIssued: !!rowValues[10],
      data: {
        date: rowValues[0],
        category: rowValues[2] || "",
        description: options.description || rowValues[3] || rowValues[2] || "Payment",
        amount: Number(rowValues[5]) || 0,
        balance: Number(rowValues[6]) || 0,
        method: normalizePaymentMethod_(options.method) || rowValues[7] || "",
        details: options.details || rowValues[8] || "",
        receiptNumber: rowValues[9] || ""
      }
    };

    if (!paymentChoice.data.amount || paymentChoice.data.amount <= 0) {
      throw new Error("Selected row is not a valid payment.");
    }

    clientSheet.getRange(sheetRow, 4).setValue(paymentChoice.data.description);
    clientSheet.getRange(sheetRow, 8).setValue(paymentChoice.data.method);
    clientSheet.getRange(sheetRow, 9).setValue(paymentChoice.data.details);

    const extraNote = options.extraNote || "";
    const receiptNum = paymentChoice.data.receiptNumber || getNextDocumentNumber("AR", targetClient);

    tempSheet = templateSheet.copyTo(ss).setName(makeTempSheetName_("TEMP_AR", targetClient));
    tempSheet.showSheet();
    removeSheetProtections_(tempSheet);

    const receiptDateStr = formatDateLong_(new Date());
    const paymentDateStr = formatDateLong_(paymentChoice.data.date);
    const paymentForText = paymentChoice.data.description;

    replaceTags_(tempSheet, buildReceiptTags_({
      receiptNum: receiptNum,
      receiptDate: receiptDateStr,
      paymentDate: paymentDateStr,
      clientName: ctx.clientName,
      clientAddress: ctx.clientAddress,
      clientPhone: ctx.clientPhone,
      caseTitle: ctx.caseTitle,
      caseNumber: ctx.caseNumber,
      paymentFor: paymentForText,
      amount: paymentChoice.data.amount,
      balanceAfter: paymentChoice.data.balance,
      method: paymentChoice.data.method,
      paymentDetails: paymentChoice.data.details,
      receivedBy: getSettingValue("Firm Name", "HERNANDEZ & LUMANAG")
    }));

    SpreadsheetApp.flush();

    prepareReceiptSheetForPdf_(tempSheet, templateSheet);
    const pdfBlob = exportReceiptSheetToPdf_(
      ss,
      tempSheet,
      receiptNum + "_" + targetClient + "_Acknowledgment_Receipt.pdf",
      getReceiptPdfExportOptions_(tempSheet)
    );

    const emailBody = buildBillingReceiptEmailPlain_(
      ctx,
      receiptNum,
      paymentChoice.data,
      paymentDateStr,
      paymentForText,
      extraNote,
      options
    );
    const htmlBody = buildBillingReceiptEmailHtml_(
      ctx,
      receiptNum,
      paymentChoice.data,
      paymentDateStr,
      paymentForText,
      extraNote,
      options
    );
    const subject = "Acknowledgment Receipt: " + receiptNum + " - " + targetClient;
    const savedFile = getOrCreateBillingFolder(GL.folders.ar).createFile(pdfBlob);

    clientSheet.getRange(sheetRow, 10).setValue(receiptNum);

    if (action === "Send Now") {
      sendBillingEmailHeadless_(ctx.email, subject, emailBody, htmlBody, pdfBlob);
      clientSheet.getRange(sheetRow, 11).setValue(new Date());
    } else {
      var arDraftOpts = getFirmFromOptions_();
      arDraftOpts.htmlBody = htmlBody;
      arDraftOpts.inlineImages = getInlineImages_();
      arDraftOpts.attachments = [pdfBlob];
      GmailApp.createDraft(ctx.email, subject, emailBody, arDraftOpts);
    }

    setPdfLink_(clientSheet.getRange(sheetRow, 12), savedFile.getUrl(), "View AR");

    logDocument_({
      clientCode: targetClient,
      clientName: ctx.clientName,
      type: "AR",
      number: receiptNum,
      amount: paymentChoice.data.amount,
      email: ctx.email,
      url: savedFile.getUrl(),
      status: action === "Send Now" ? "Sent" : "Draft Created"
    });

    updateSingleClientStatus_(targetClient);

    return {
      ok: true,
      message: action === "Send Now"
        ? "Acknowledgment Receipt " + receiptNum + " sent to " + ctx.email + "."
        : "AR Gmail draft created for " + ctx.email + ".",
      receiptNumber: receiptNum
    };
  } finally {
    if (tempSheet) safeDeleteSheet_(tempSheet, targetClient || GL.sheets.master);
  }
}

/**
 * Notarization acknowledgment receipt — standalone (no client tab required).
 * Fills the Acknowledgment Receipt template tab from the notarization data,
 * exports a PDF to the notarial receipts (NR) Drive folder, and returns the PDF URL.
 * The Next.js app records the register row and writes the PDF link back.
 *
 * options: { receiptNo, date, name, address, documentType, docNo, pageNo,
 *            bookNo, series, amount, paymentMethod, paymentDetails }
 */
function generateNotarialReceiptHeadless_(options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tempSheet = null;

  if (!options || !options.name) throw new Error("Name is required.");
  const receiptNum = String(options.receiptNo || getNextDocumentNumber("NR", "NOTARIAL")).trim();
  const amount = Number(options.amount) || 0;
  if (amount <= 0) throw new Error("A valid amount is required.");

  try {
    const templateSheet = ss.getSheetByName(GL.sheets.receipt);
    if (!templateSheet) throw new Error("Could not find the Acknowledgment Receipt tab.");

    tempSheet = templateSheet.copyTo(ss).setName(makeTempSheetName_("TEMP_NR", "NOTARIAL"));
    tempSheet.showSheet();
    removeSheetProtections_(tempSheet);

    const receiptDateStr = formatDateLong_(new Date());
    const paymentDateStr = options.date ? formatDateLong_(options.date) : receiptDateStr;
    const paymentFor = notarizationReceiptPaymentFor_(String(options.documentType || ""));
    var notarialDetails = [
      options.docNo ? "Doc No. " + options.docNo : "",
      options.pageNo ? "Page " + options.pageNo : "",
      options.bookNo ? "Book " + options.bookNo : "",
      options.series ? "Series " + options.series : "",
      options.paymentDetails || ""
    ]
      .filter(function (part) { return !!part; })
      .join("  ·  ");

    replaceTags_(tempSheet, buildReceiptTags_({
      receiptNum: receiptNum,
      receiptDate: receiptDateStr,
      paymentDate: paymentDateStr,
      clientName: String(options.name || ""),
      clientAddress: String(options.address || ""),
      caseTitle: paymentFor,
      paymentFor: paymentFor,
      documentType: String(options.documentType || ""),
      docNo: String(options.docNo || ""),
      pageNo: String(options.pageNo || ""),
      bookNo: String(options.bookNo || ""),
      series: String(options.series || ""),
      amount: amount,
      balanceAfter: 0,
      method: String(options.paymentMethod || ""),
      paymentDetails: notarialDetails,
      receivedBy: getSettingValue("Firm Name", "HERNANDEZ & LUMANAG")
    }));

    SpreadsheetApp.flush();

    prepareReceiptSheetForPdf_(tempSheet, templateSheet);
    const pdfBlob = exportReceiptSheetToPdf_(
      ss,
      tempSheet,
      receiptNum + "_Notarial_Acknowledgment_Receipt.pdf",
      getReceiptPdfExportOptions_(tempSheet)
    );
    const savedFile = getOrCreateNrFolder_().createFile(pdfBlob);

    logDocument_({
      clientCode: "NOTARIAL",
      clientName: String(options.name || ""),
      type: "NR",
      number: receiptNum,
      amount: amount,
      email: "",
      url: savedFile.getUrl(),
      status: "Recorded"
    });

    return {
      ok: true,
      message: "Notarial receipt " + receiptNum + " generated.",
      receiptNumber: receiptNum,
      pdfUrl: savedFile.getUrl()
    };
  } finally {
    if (tempSheet) safeDeleteSheet_(tempSheet, GL.sheets.master);
  }
}

/** Flat folder for notarial receipt (NR) PDFs — not the monthly client AR tree. */
function getOrCreateNrFolder_() {
  var configured = String(
    getSettingValue("NR Folder ID", "") || getSettingValue("Notarial Receipt Folder ID", "")
  ).trim();
  if (configured) {
    var folderMatch = configured.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    var folderId = folderMatch ? folderMatch[1] : configured;
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      throw new Error("NR Folder ID in Settings is not valid or not accessible in Drive.");
    }
  }

  var names = ["Notarial Receipts", "NR", "HA Billing NR"];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var parent = null;
  var parentFolders = DriveApp.getFileById(ss.getId()).getParents();
  if (parentFolders.hasNext()) {
    parent = parentFolders.next();
  }

  if (parent) {
    for (var i = 0; i < names.length; i++) {
      var beside = parent.getFoldersByName(names[i]);
      if (beside.hasNext()) return beside.next();
    }
  }

  for (var j = 0; j < names.length; j++) {
    var global = DriveApp.getFoldersByName(names[j]);
    if (global.hasNext()) return global.next();
  }

  if (parent) {
    return parent.createFolder("Notarial Receipts");
  }
  return DriveApp.createFolder("Notarial Receipts");
}

/** Return the Drive folder where client acknowledgment receipt PDFs are stored (monthly via code.gs). */
function getArFolderHeadless_() {
  const folder = getOrCreateBillingFolder(GL.folders.ar);
  return {
    ok: true,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    folderName: folder.getName()
  };
}

/** Return the flat notarial receipts (NR) folder. */
function getNrFolderHeadless_() {
  const folder = getOrCreateNrFolder_();
  return {
    ok: true,
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    folderName: folder.getName()
  };
}
