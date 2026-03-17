// ═══════════════════════════════════════════════════════════
// EonCanvas Artwork Sold State — Google Apps Script
// Paste this entire file into Google Apps Script
// ═══════════════════════════════════════════════════════════

var SHEET_NAME = "SoldState";
var ARTWORK_ID = "world-is-cracked";

// ── Called by your shop page to CHECK if artwork is sold ──
function doGet(e) {
  var sold = isSold();
  return ContentService
    .createTextOutput(JSON.stringify({ sold: sold }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Called by PayPal IPN to MARK artwork as sold ──
// ── Also called by shop.html form to SAVE order details ──
function doPost(e) {

  // Handle order form submission from shop.html
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'saveOrder') {
      saveOrderDetails(body);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'order_saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    // Not JSON — continue to IPN handling below
  }

  var params = e.parameter;

  // Verify it's a real PayPal payment
  var txnType   = params.txn_type     || "";
  var payStatus = params.payment_status || "";
  var itemName  = params.item_name    || "";
  var amount    = parseFloat(params.mc_gross || "0");
  var currency  = params.mc_currency  || "";

  // Accept if: completed payment, right amount, right currency
  var validAmount   = (amount >= 900);
  var validCurrency = (currency === "GBP");
  var validStatus   = (payStatus === "Completed");

  if (validStatus && validAmount && validCurrency) {
    markSold(params);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "sold", recorded: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Log rejected payments for review
  logRejected(params);
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ignored" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Check sold state ──
function isSold() {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === ARTWORK_ID && data[i][1] === "SOLD") {
      return true;
    }
  }
  return false;
}

// ── Write sold record ──
function markSold(params) {
  var sheet = getSheet();
  sheet.appendRow([
    ARTWORK_ID,
    "SOLD",
    new Date().toISOString(),
    params.payer_email    || "",
    params.mc_gross       || "",
    params.mc_currency    || "",
    params.txn_id         || "",
    params.payer_name     || ""
  ]);
}

// ── Log rejected / unverified payments ──
function logRejected(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("RejectedPayments");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet()
      .insertSheet("RejectedPayments");
    sheet.appendRow(["ArtworkID","Status","Timestamp","Email","Amount","Currency","TxnID","Reason"]);
  }
  sheet.appendRow([
    ARTWORK_ID,
    params.payment_status || "unknown",
    new Date().toISOString(),
    params.payer_email    || "",
    params.mc_gross       || "",
    params.mc_currency    || "",
    params.txn_id         || "",
    "Did not meet validation criteria"
  ]);
}

// ── Get or create the SoldState sheet ──
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ArtworkID","Status","Timestamp","PayerEmail","Amount","Currency","TxnID","PayerName"]);
  }
  return sheet;
}

// ── Save order details from shop form ──
function saveOrderDetails(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    sheet = ss.insertSheet("Orders");
    sheet.appendRow(["Timestamp","Name","Email","Address","Country","Amount","Status"]);
    // Style header row
    sheet.getRange(1,1,1,7).setFontWeight("bold").setBackground("#c9a84c").setFontColor("#000000");
  }
  sheet.appendRow([
    new Date().toISOString(),
    data.name    || "",
    data.email   || "",
    data.address || "",
    data.country || "",
    data.amount  || "",
    "Pending Payment"
  ]);
}

// ── Manual override: run this function to mark sold manually ──
function markSoldManually() {
  markSold({
    payer_email: "manual-override",
    mc_gross:    "900",
    mc_currency: "GBP",
    txn_id:      "MANUAL-" + new Date().getTime(),
    payer_name:  "Manual Override"
  });
  Logger.log("Artwork marked as SOLD manually.");
}

// ── Manual override: run this to RESET (un-sell) for testing ──
function resetForTesting() {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === ARTWORK_ID) {
      sheet.deleteRow(i + 1);
    }
  }
  Logger.log("Reset complete — artwork is now available again.");
}