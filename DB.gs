// =============================================================================
// DB.gs — Choice Monitor: Database Initialization & Sheet Management
// =============================================================================

function _getSpreadsheet() {
  if (!CM_SPREADSHEET_ID) {
    throw new Error('[DB.gs] CM_SPREADSHEET_ID is empty. Set it via Script Properties.');
  }
  return SpreadsheetApp.openById(CM_SPREADSHEET_ID);
}

function _ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    created = true;
    SystemLogger.info('[DB.gs] Created sheet: ' + sheetName);
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = firstRow.every(function(cell) { return cell === '' || cell === null; });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    SystemLogger.info('[DB.gs] Headers written for sheet: ' + sheetName);
  }

  return { created: created, sheet: sheet };
}

function initSheets() {
  try {
    const ss = _getSpreadsheet();
    const results = {};

    const sheetDefinitions = [
      { name: SHEET_NAMES.CUBE_SESSIONS,    headers: CUBE_SESSIONS_HEADERS },
      { name: SHEET_NAMES.CUBE_TIMES_MACRO, headers: CUBE_TIMES_MACRO_HEADERS },
      { name: SHEET_NAMES.CUBE_OPPORTUNITY, headers: CUBE_OPPORTUNITY_HEADERS },
      { name: SHEET_NAMES.ALERTS_CONFIG,    headers: ALERTS_CONFIG_HEADERS },
      { name: SHEET_NAMES.ALERTS_LOG,       headers: ALERTS_LOG_HEADERS },
      { name: SHEET_NAMES.USAGE_LOG,        headers: USAGE_LOG_HEADERS },
    ];

    sheetDefinitions.forEach(function(def) {
      const result = _ensureSheet(ss, def.name, def.headers);
      results[def.name] = { created: result.created, headerCount: def.headers.length };
    });

    SystemLogger.info('[DB.gs] initSheets() completed successfully.');
    return buildResponse(true, results, null);

  } catch (e) {
    SystemLogger.error('[DB.gs] initSheets() failed: ' + e.message);
    return buildResponse(false, null, e.message);
  }
}

function getSheet(sheetName) {
  const ss = _getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('[DB.gs] Sheet "' + sheetName + '" not found.');
  return sheet;
}

function clearSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    SystemLogger.info('[DB.gs] Cleared data rows from sheet: ' + sheetName);
  }
}

function writeDataToSheet(sheetName, data) {
  if (!data || data.length === 0) return;
  const sheet = getSheet(sheetName);
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  SystemLogger.info('[DB.gs] Wrote ' + data.length + ' rows to: ' + sheetName);
}

function appendDataToSheet(sheetName, data) {
  if (!data || data.length === 0) return;
  const sheet = getSheet(sheetName);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(lastRow + 1, 1, data.length, data[0].length).setValues(data);
  SystemLogger.info('[DB.gs] Appended ' + data.length + ' rows to: ' + sheetName);
}