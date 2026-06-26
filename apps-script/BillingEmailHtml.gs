/**
 * HA Billing — Elegant SOA / AR email bodies (HTML + plain text)
 * Paste after WebAppHeadless.gs helpers. Redeploy Web App after changes.
 */

var BILLING_EMAIL = {
  gold: "#8a6b2a",
  goldLight: "#b8913d",
  goldPale: "#e8dcc4",
  cream: "#faf8f4",
  ink: "#1a1612",
  muted: "#4a4339",
  serif: "Georgia,'Times New Roman',serif",
  sans: "Arial,Helvetica,sans-serif"
};

function escapeBillingHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function billingEmailShell_(title, subtitle, innerHtml) {
  return (
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;width:100%;">' +
    '<tr><td bgcolor="' +
    BILLING_EMAIL.cream +
    '" style="padding:28px 28px 26px;border:1px solid ' +
    BILLING_EMAIL.goldPale +
    ';">' +
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%">' +
    '<tr><td style="border-bottom:2px solid ' +
    BILLING_EMAIL.goldLight +
    ';padding-bottom:14px;">' +
    '<p style="margin:0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:' +
    BILLING_EMAIL.gold +
    ';font-weight:700;">' +
    escapeBillingHtml_(title) +
    "</p>" +
    '<p style="margin:6px 0 0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:18px;line-height:1.3;color:' +
    BILLING_EMAIL.ink +
    ';font-weight:700;">' +
    escapeBillingHtml_(subtitle) +
    "</p>" +
    "</td></tr>" +
    '<tr><td style="padding-top:22px;">' +
    innerHtml +
    "</td></tr></table></td></tr></table>"
  );
}

function billingDetailRow_(label, value) {
  return (
    "<tr>" +
    '<td style="padding:7px 0;font-family:' +
    BILLING_EMAIL.sans +
    ';font-size:12px;color:' +
    BILLING_EMAIL.muted +
    ';width:38%;vertical-align:top;">' +
    escapeBillingHtml_(label) +
    "</td>" +
    '<td style="padding:7px 0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;color:' +
    BILLING_EMAIL.ink +
    ';font-weight:600;vertical-align:top;">' +
    escapeBillingHtml_(value) +
    "</td></tr>"
  );
}

function billingDetailsTable_(rows) {
  var body = "";
  for (var i = 0; i < rows.length; i++) {
    body += billingDetailRow_(rows[i].label, rows[i].value);
  }
  return (
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:18px 0 0;border-top:1px solid ' +
    BILLING_EMAIL.goldPale +
    ';">' +
    body +
    "</table>"
  );
}

function billingStatusReportHtml_(report) {
  if (!report || !String(report.summary || "").trim()) return "";
  return (
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:20px 0 0;background:' +
    BILLING_EMAIL.cream +
    ";border:1px solid " +
    BILLING_EMAIL.goldPale +
    ';">' +
    '<tr><td style="padding:14px 16px;">' +
    '<p style="margin:0 0 10px;font-family:' +
    BILLING_EMAIL.sans +
    ';font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:' +
    BILLING_EMAIL.gold +
    ';font-weight:700;">Status report</p>' +
    '<p style="margin:0 0 6px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;line-height:1.6;color:' +
    BILLING_EMAIL.ink +
    ';"><strong>Case:</strong> ' +
    escapeBillingHtml_(report.caseTitle || "—") +
    "</p>" +
    '<p style="margin:0 0 6px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;line-height:1.6;color:' +
    BILLING_EMAIL.ink +
    ';"><strong>Hearing / appearance:</strong> ' +
    escapeBillingHtml_(report.hearingDate || "") +
    (report.hearingTime ? " at " + escapeBillingHtml_(report.hearingTime) : "") +
    "</p>" +
    '<p style="margin:0 0 6px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;line-height:1.6;color:' +
    BILLING_EMAIL.ink +
    ';"><strong>Incident:</strong> ' +
    escapeBillingHtml_(report.incident || "—") +
    "</p>" +
    '<p style="margin:0 0 10px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;line-height:1.6;color:' +
    BILLING_EMAIL.ink +
    ';"><strong>Handling lawyer:</strong> ' +
    escapeBillingHtml_(report.handlingLawyer || "—") +
    "</p>" +
    '<p style="margin:0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:13px;line-height:1.75;color:' +
    BILLING_EMAIL.muted +
    ';">' +
    escapeBillingHtml_(report.summary) +
    "</p></td></tr></table>"
  );
}

function billingStatusReportPlain_(report) {
  if (!report || !String(report.summary || "").trim()) return "";
  return (
    "\n\nSTATUS REPORT\n" +
    "Case: " +
    (report.caseTitle || "—") +
    "\nHearing / appearance: " +
    (report.hearingDate || "") +
    (report.hearingTime ? " at " + report.hearingTime : "") +
    "\nIncident: " +
    (report.incident || "—") +
    "\nHandling lawyer: " +
    (report.handlingLawyer || "—") +
    "\n\n" +
    report.summary
  );
}

function billingSalutation_(ctx, options) {
  return "Dear Sir/Ma'am " + resolveClientGreeting_(ctx, options);
}

function buildBillingSoaEmailHtml_(ctx, invoiceNum, totalDue, statusReport, options) {
  var greeting = billingSalutation_(ctx, options);
  var hasStatus = statusReport && String(statusReport.summary || "").trim();
  var intro = hasStatus
    ? "Please find attached your Statement of Account. For your reference, we have also included a brief status report regarding your matter below."
    : "Please find attached your Statement of Account for your review and records.";

  var inner =
    '<p style="margin:0 0 4px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:15px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">' +
    escapeBillingHtml_(greeting) +
    ",</p>" +
    '<p style="margin:0 0 18px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">Good day.</p>' +
    '<p style="margin:0 0 16px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.8;color:' +
    BILLING_EMAIL.muted +
    ';">' +
    escapeBillingHtml_(intro) +
    "</p>" +
    '<p style="margin:0 0 16px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.8;color:' +
    BILLING_EMAIL.muted +
    ';">Should you have any questions regarding the billing details' +
    (hasStatus ? " or the status report" : "") +
    ", kindly contact our office. We appreciate your prompt attention to the amount due by the date indicated in the attached SOA.</p>" +
    billingDetailsTable_([
      { label: "Invoice no.", value: invoiceNum },
      { label: "Client reference", value: ctx.clientCode || "" },
      { label: "Total amount due", value: formatPhp_(totalDue) }
    ]) +
    (hasStatus ? billingStatusReportHtml_(statusReport) : "") +
    '<p style="margin:22px 0 0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">Thank you for your continued trust in our firm.</p>';

  return (
    '<div style="font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.65;color:' +
    BILLING_EMAIL.ink +
    ';">' +
    billingEmailShell_("Billing", "Statement of Account", inner) +
    getEmailSignatureHtml() +
    "</div>"
  );
}

function buildBillingSoaEmailPlain_(ctx, invoiceNum, totalDue, statusReport, options) {
  var greeting = billingSalutation_(ctx, options);
  var hasStatus = statusReport && String(statusReport.summary || "").trim();
  var intro = hasStatus
    ? "Please find attached your Statement of Account. For your reference, we have also included a brief status report regarding your matter below."
    : "Please find attached your Statement of Account for your review and records.";

  return (
    greeting +
    ",\n\nGood day.\n\n" +
    intro +
    "\n\nShould you have any questions regarding the billing details" +
    (hasStatus ? " or the status report" : "") +
    ", kindly contact our office. We appreciate your prompt attention to the amount due by the date indicated in the attached SOA.\n\n" +
    "Invoice No.: " +
    invoiceNum +
    "\nClient reference: " +
    (ctx.clientCode || "") +
    "\nTotal amount due: " +
    formatPhp_(totalDue) +
    billingStatusReportPlain_(statusReport) +
    "\n\nThank you for your continued trust in our firm."
  );
}

function buildBillingReceiptEmailHtml_(ctx, receiptNum, paymentData, paymentDateStr, paymentForText, extraNote, options) {
  var greeting = billingSalutation_(ctx, options);
  var noteHtml = extraNote
    ? '<p style="margin:16px 0 0;font-family:' +
      BILLING_EMAIL.serif +
      ';font-size:13px;line-height:1.7;color:' +
      BILLING_EMAIL.muted +
      ';"><strong style="color:' +
      BILLING_EMAIL.ink +
      ';">Note:</strong> ' +
      escapeBillingHtml_(extraNote) +
      "</p>"
    : "";

  var inner =
    '<p style="margin:0 0 4px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:15px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">' +
    escapeBillingHtml_(greeting) +
    ",</p>" +
    '<p style="margin:0 0 18px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">Good day.</p>' +
    '<p style="margin:0 0 16px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.8;color:' +
    BILLING_EMAIL.muted +
    ';">We acknowledge receipt of your recent payment. Please find attached your official Acknowledgment Receipt for your records.</p>' +
    '<p style="margin:0 0 16px;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.8;color:' +
    BILLING_EMAIL.muted +
    ';">We sincerely appreciate your prompt payment and truly value the trust you continue to place in our firm.</p>' +
    billingDetailsTable_([
      { label: "Receipt no.", value: receiptNum },
      { label: "Payment date", value: paymentDateStr },
      { label: "Amount paid", value: formatPhp_(paymentData.amount) },
      { label: "Payment method", value: paymentData.method || "—" },
      { label: "Payment details", value: paymentData.details || "—" },
      { label: "Payment for", value: paymentForText || "Payment received" },
      { label: "Remaining balance", value: formatPhp_(paymentData.balance) }
    ]) +
    noteHtml +
    '<p style="margin:22px 0 0;font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.7;color:' +
    BILLING_EMAIL.ink +
    ';">Thank you.</p>';

  return (
    '<div style="font-family:' +
    BILLING_EMAIL.serif +
    ';font-size:14px;line-height:1.65;color:' +
    BILLING_EMAIL.ink +
    ';">' +
    billingEmailShell_("Receipt", "Acknowledgment of Payment", inner) +
    getEmailSignatureHtml() +
    "</div>"
  );
}

function buildBillingReceiptEmailPlain_(ctx, receiptNum, paymentData, paymentDateStr, paymentForText, extraNote, options) {
  var greeting = billingSalutation_(ctx, options);
  var noteText = extraNote ? "\n\nNote: " + extraNote : "";

  return (
    greeting +
    ",\n\nGood day.\n\n" +
    "We acknowledge receipt of your recent payment. Please find attached your official Acknowledgment Receipt for your records.\n\n" +
    "We sincerely appreciate your prompt payment and truly value the trust you continue to place in our firm.\n\n" +
    "Receipt No.: " +
    receiptNum +
    "\nPayment Date: " +
    paymentDateStr +
    "\nAmount Paid: " +
    formatPhp_(paymentData.amount) +
    "\nPayment Method: " +
    (paymentData.method || "—") +
    "\nPayment Details: " +
    (paymentData.details || "—") +
    "\nPayment For: " +
    (paymentForText || "Payment received") +
    "\nRemaining Balance: " +
    formatPhp_(paymentData.balance) +
    noteText +
    "\n\nThank you."
  );
}

function notarizationReceiptPaymentFor_(documentType) {
  var doc = String(documentType || "").trim();
  return doc ? "Notarization of " + doc : "Notarization of the document specified";
}

function buildReceiptTags_(data) {
  var methodLower = String(data.method || "").toLowerCase();
  var transferCheck = /bank|transfer|gcash|maya|online|e-wallet|ewallet/.test(methodLower) ? "✓" : " ";

  return {
    "{{RECEIPT_NUMBER}}": data.receiptNum,
    "{{RECEIPT_DATE}}": data.receiptDate,
    "{{PAYMENT_DATE}}": data.paymentDate,
    "{{CLIENT_NAME}}": data.clientName,
    "{{CLIENT_ADDRESS}}": data.clientAddress || "",
    "{{CLIENT_PHONE}}": data.clientPhone || "",
    "{{CASE_TITLE}}": data.caseTitle || "",
    "{{CASE_NUMBER}}": data.caseNumber || "",
    "{{PAYMENT_FOR}}": data.paymentFor || "",
    "{{DOCUMENT_TYPE}}": data.documentType || "",
    "{{DOC_NUMBER}}": data.docNo || "",
    "{{PAGE_NUMBER}}": data.pageNo || "",
    "{{BOOK_NUMBER}}": data.bookNo || "",
    "{{SERIES}}": data.series || "",
    "{{AMOUNT_PAID}}": Number(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2 }),
    "{{AMOUNT_PAID_WORDS}}": amountToWords(data.amount) + " Pesos",
    "{{BALANCE_AFTER_PAYMENT}}": formatPhp_(data.balanceAfter),
    "{{PAYMENT_METHOD}}": data.method || "",
    "{{PAYMENT_DETAILS}}": data.paymentDetails || "",
    "{{CASH_CHECK}}": methodLower.indexOf("cash") !== -1 ? "✓" : " ",
    "{{TRANSFER_CHECK}}": transferCheck,
    "{{BANK_TRANSFER_CHECK}}": transferCheck,
    "{{CHECK_CHECK}}": /check|cheque/.test(methodLower) ? "✓" : " ",
    "{{RECEIVED_BY}}": data.receivedBy || getSettingValue("Firm Name", "HERNANDEZ & ASSOCIATES")
  };
}
