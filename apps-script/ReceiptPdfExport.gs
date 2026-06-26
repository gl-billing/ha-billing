/**
 * HA Billing — Acknowledgment receipt PDF (single page, exact template size)
 *
 * Fixes 2-page split (right side or footer on page 2) by exporting at 100% scale,
 * paging down-then-across, and sizing the page from measured row/column dimensions.
 *
 * Default crop: rows 1–25, columns A–G (override via Settings if template changes).
 *
 * Optional Settings (clamped to the temp sheet — never larger than the tab):
 *   Receipt PDF Last Row     e.g. 25  (last row with receipt content)
 *   Receipt PDF Last Col     e.g. 7   (rightmost column; G = 7)
 *   Receipt PDF Width (mm)   e.g. 127 (minimum width — export may be wider)
 *   Receipt PDF Height (mm)  optional minimum height (omit to fit content through last used row)
 *   Receipt PDF Width (in)   hard override in inches
 *   Receipt PDF Height (in)  hard override in inches
 *
 * Redeploy the Web App after pasting this file into Apps Script.
 */

var RECEIPT_ROW_PX_PER_INCH = 72;
var RECEIPT_COL_PX_PER_INCH = 96;
var RECEIPT_WIDTH_PAD_IN = 0.2;
var RECEIPT_HEIGHT_PAD_IN = 0.08;
/** Extra headroom so measured width matches print preview at 100%. */
var RECEIPT_SIZE_BUFFER = 1.06;
var RECEIPT_HEIGHT_SIZE_BUFFER = 1.0;
var RECEIPT_DEFAULT_WIDTH_MM = 127;
var RECEIPT_DEFAULT_HEIGHT_MM = 203;
/** Acknowledgment Receipt template — A1:G25 */
var RECEIPT_DEFAULT_LAST_ROW = 25;
var RECEIPT_DEFAULT_LAST_COL = 7;

function safeSheetExtents_(sheet) {
  return {
    maxRows: Math.max(1, sheet.getMaxRows()),
    maxCols: Math.max(1, sheet.getMaxColumns()),
    lastRow: Math.max(1, sheet.getLastRow()),
    lastCol: Math.max(1, sheet.getLastColumn())
  };
}

function clampReceiptRowCol_(sheet, row, col) {
  var ext = safeSheetExtents_(sheet);
  return {
    lastRow: Math.min(Math.max(1, row), ext.maxRows),
    lastCol: Math.min(Math.max(1, col), ext.maxCols)
  };
}

function prepareReceiptSheetForPdf_(sheet, templateSheet) {
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  trimReceiptSheetSurplus_(sheet);
  var bounds = getReceiptContentBounds_(sheet);
  var pageSize = getReceiptPdfPageSizeInches_(sheet, bounds);
  applyReceiptPrintSetup_(sheet, bounds, pageSize);
  SpreadsheetApp.flush();
}

function rowHasReceiptContent_(sheet, row, lastCol) {
  var values = sheet.getRange(row, 1, row, lastCol).getValues()[0];
  var i;
  for (i = 0; i < values.length; i++) {
    var cell = values[i];
    if (cell !== "" && cell !== null && cell !== undefined) return true;
  }
  return false;
}

function findReceiptLastContentRow_(sheet) {
  var setting = String(getSettingValue("Receipt PDF Last Row", "") || "").trim();
  if (setting) {
    return clampReceiptRowCol_(sheet, Number(setting), 1).lastRow;
  }

  var maxCol = clampReceiptRowCol_(sheet, RECEIPT_DEFAULT_LAST_ROW, RECEIPT_DEFAULT_LAST_COL).lastCol;
  var scanThrough = Math.min(
    Math.max(1, sheet.getLastRow()),
    clampReceiptRowCol_(sheet, RECEIPT_DEFAULT_LAST_ROW, maxCol).lastRow
  );

  var r;
  for (r = scanThrough; r >= 1; r--) {
    if (rowHasReceiptContent_(sheet, r, maxCol)) return r;
  }
  return 1;
}

function findReceiptLastContentCol_(sheet, lastRow) {
  var setting = String(getSettingValue("Receipt PDF Last Col", "") || "").trim();
  var col = setting ? Number(setting) : RECEIPT_DEFAULT_LAST_COL;
  return clampReceiptRowCol_(sheet, lastRow, col).lastCol;
}

/** Grid indices for export URL: r1/c1 are 0-based start; r2/c2 are 1-based end row/col. */
function getReceiptContentBounds_(sheet) {
  var lastRow = findReceiptLastContentRow_(sheet);
  var lastCol = findReceiptLastContentCol_(sheet, lastRow);
  var clamped = clampReceiptRowCol_(sheet, lastRow, lastCol);
  return {
    r1: 0,
    c1: 0,
    r2: clamped.lastRow,
    c2: clamped.lastCol,
    lastRow: clamped.lastRow,
    lastCol: clamped.lastCol
  };
}

function columnToLetter_(col) {
  var letter = "";
  while (col > 0) {
    var mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - mod) / 26);
  }
  return letter;
}

function getReceiptRangeA1_(bounds) {
  return "A1:" + columnToLetter_(bounds.lastCol) + bounds.lastRow;
}

function trimReceiptSheetSurplus_(sheet) {
  var bounds = getReceiptContentBounds_(sheet);
  var ext = safeSheetExtents_(sheet);
  var lastRow = bounds.lastRow;
  var lastCol = bounds.lastCol;
  if (lastRow < 1 || lastCol < 1) return;

  if (lastRow < ext.maxRows) {
    sheet.deleteRows(lastRow + 1, ext.maxRows - lastRow);
  }
  if (lastCol < ext.maxCols) {
    sheet.deleteColumns(lastCol + 1, ext.maxCols - lastCol);
  }
}

function roundReceiptInches_(value) {
  return Math.round(Number(value) * 100) / 100;
}

function mmToInches_(mm) {
  return roundReceiptInches_(Number(mm) / 25.4);
}

function getReceiptPdfPageSizeInches_(sheet, bounds) {
  var widthInSetting = String(getSettingValue("Receipt PDF Width (in)", "") || "").trim();
  var heightInSetting = String(getSettingValue("Receipt PDF Height (in)", "") || "").trim();
  var widthMmSetting = String(getSettingValue("Receipt PDF Width (mm)", "") || "").trim();
  var heightMmSetting = String(getSettingValue("Receipt PDF Height (mm)", "") || "").trim();

  var totalWidthPx = 0;
  var totalHeightPx = 0;
  var c;
  var r;

  for (c = 1; c <= bounds.lastCol; c++) {
    totalWidthPx += sheet.getColumnWidth(c);
  }
  for (r = 1; r <= bounds.lastRow; r++) {
    totalHeightPx += sheet.getRowHeight(r);
  }

  var calculatedWidthIn =
    roundReceiptInches_((totalWidthPx / RECEIPT_COL_PX_PER_INCH) * RECEIPT_SIZE_BUFFER) +
    RECEIPT_WIDTH_PAD_IN;
  var calculatedHeightIn =
    roundReceiptInches_((totalHeightPx / RECEIPT_ROW_PX_PER_INCH) * RECEIPT_HEIGHT_SIZE_BUFFER) +
    RECEIPT_HEIGHT_PAD_IN;

  var templateWidthIn = mmToInches_(widthMmSetting || RECEIPT_DEFAULT_WIDTH_MM);

  var widthIn = widthInSetting
    ? roundReceiptInches_(widthInSetting)
    : Math.max(templateWidthIn, calculatedWidthIn);

  var heightIn = heightInSetting
    ? roundReceiptInches_(heightInSetting)
    : heightMmSetting
      ? Math.max(mmToInches_(heightMmSetting), calculatedHeightIn)
      : calculatedHeightIn;

  widthIn = Math.max(1.5, widthIn);
  heightIn = Math.max(1.5, heightIn);

  return widthIn + "x" + heightIn;
}

/** Optional: copy print area + custom page size onto the temp tab (enable Google Sheets API service). */
function applyReceiptPrintSetup_(sheet, bounds, pageSizeInches) {
  try {
    if (typeof Sheets === "undefined" || !Sheets.Spreadsheets) return;

    var parts = String(pageSizeInches).toLowerCase().split("x");
    var widthIn = Number(parts[0]) || mmToInches_(RECEIPT_DEFAULT_WIDTH_MM);
    var heightIn = Number(parts[1]) || mmToInches_(RECEIPT_DEFAULT_HEIGHT_MM);

    Sheets.Spreadsheets.batchUpdate(
      {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheet.getSheetId(),
                pageSetup: {
                  paperSize: "CUSTOM",
                  pageSize: {
                    width: { magnitude: widthIn * 25.4, unit: "MM" },
                    height: { magnitude: heightIn * 25.4, unit: "MM" }
                  },
                  margin: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    header: 0,
                    footer: 0
                  },
                  printArea: getReceiptRangeA1_(bounds)
                }
              },
              fields: "pageSetup"
            }
          }
        ]
      },
      sheet.getParent().getId()
    );
  } catch (e) {
    Logger.log("applyReceiptPrintSetup_ skipped: " + e);
  }
}

function getReceiptPdfExportOptions_(sheet) {
  var bounds = getReceiptContentBounds_(sheet);
  return {
    size: getReceiptPdfPageSizeInches_(sheet, bounds),
    portrait: true,
    scale: 1,
    pageorder: 1,
    r1: bounds.r1,
    c1: bounds.c1,
    r2: bounds.r2,
    c2: bounds.c2,
    top_margin: 0,
    bottom_margin: 0,
    left_margin: 0,
    right_margin: 0,
    horizontal_alignment: "LEFT",
    vertical_alignment: "TOP",
    gridlines: false,
    printtitle: false,
    sheetnames: false,
    pagenumbers: false
  };
}

function exportReceiptSheetToPdf_(ss, sheet, filename, options) {
  var opts = options || getReceiptPdfExportOptions_(sheet);
  var bounds = getReceiptContentBounds_(sheet);
  var pageSize = String(opts.size || getReceiptPdfPageSizeInches_(sheet, bounds));

  var url =
    "https://docs.google.com/spreadsheets/d/" +
    ss.getId() +
    "/export?exportFormat=pdf&format=pdf" +
    "&gid=" +
    sheet.getSheetId() +
    "&size=" +
    encodeURIComponent(pageSize) +
    "&portrait=" +
    (opts.portrait === false ? "false" : "true") +
    "&scale=" +
    (opts.scale !== undefined ? opts.scale : 1) +
    "&fitw=false&fith=false" +
    "&pageorder=" +
    (opts.pageorder !== undefined ? opts.pageorder : 1) +
    "&r1=" +
    (opts.r1 !== undefined ? opts.r1 : bounds.r1) +
    "&c1=" +
    (opts.c1 !== undefined ? opts.c1 : bounds.c1) +
    "&r2=" +
    (opts.r2 !== undefined ? opts.r2 : bounds.r2) +
    "&c2=" +
    (opts.c2 !== undefined ? opts.c2 : bounds.c2) +
    "&top_margin=0.00&bottom_margin=0.00&left_margin=0.00&right_margin=0.00" +
    "&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&pagenumbers=false" +
    "&fzr=false&fzc=false&printnotes=false" +
    "&horizontal_alignment=LEFT&vertical_alignment=TOP";

  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      "Receipt PDF export failed (" +
        response.getResponseCode() +
        "): " +
        response.getContentText().slice(0, 200)
    );
  }

  return response.getBlob().setName(filename);
}
