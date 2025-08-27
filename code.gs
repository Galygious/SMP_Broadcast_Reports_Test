function doPost(e) {
  try {
    // Parse the incoming request body as JSON
    const req = JSON.parse(e.postData.contents || "{}");

    // Validate secret
    if (req.secret !== PropertiesService.getScriptProperties().getProperty('GOOGLE_SCRIPT_SECRET')) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "Unauthorized" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    let result;

    switch (req.action) {
      case "getSheetNames":
        result = { ok: true, sheetNames: getSheetNames() };
        break;

      case "getSheetContent":
        result = getSheetContent(req.sheetName);
        break;

      case "saveData":
        result = saveData(req.sheetName, req.data);
        break;

      case "appendData":
        result = appendData(req.values, req.sheetDate);
        break;

      default:
        result = { ok: false, error: "Unknown action" };
    }

    return ContentService.createTextOutput(
      JSON.stringify(result)
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetNames() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();
  // Optional: filter only date-formatted names like "YYYY-MM-DD"
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return sheets.map(s => s.getName()).filter(name => regex.test(name));
}

function getSheetContent(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return { ok: false, error: "Sheet not found: " + sheetName };
  }

  const values = sheet.getDataRange().getValues(); // 2D array
  return { ok: true, data: values };
}

function saveData(sheetName, data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Check if sheet exists, if not create it
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
    } else {
      // Clear existing content
      sheet.clear();
    }
    
    // Validate data is array
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "Invalid data format - expected non-empty array" };
    }
    
    // Write data to sheet
    const range = sheet.getRange(1, 1, data.length, data[0].length);
    range.setValues(data);
    
    return { 
      ok: true, 
      message: `Successfully saved ${data.length} rows to sheet '${sheetName}'`,
      rowsWritten: data.length
    };
    
  } catch (error) {
    return { ok: false, error: "Failed to save data: " + error.message };
  }
}

function appendData(values, sheetDate) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Use provided sheet date or fall back to today's date
    const today = new Date();
    const sheetName = sheetDate || today.toISOString().slice(0, 10);
    
    // Check if sheet exists
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      // Clear existing content to overwrite
      sheet.clear();
    } else {
      // Create new sheet at position 0 (first position)
      sheet = spreadsheet.insertSheet(sheetName, 0);
    }
    
    // Validate values is array
    if (!Array.isArray(values) || values.length === 0) {
      return { ok: false, error: "Invalid values format - expected non-empty array" };
    }
    
    // Write data to sheet
    const range = sheet.getRange(1, 1, values.length, values[0].length);
    range.setValues(values);
    
    return { 
      ok: true, 
      message: `Successfully created sheet '${sheetName}' with ${values.length} rows`,
      sheetName: sheetName,
      rowsWritten: values.length
    };
    
  } catch (error) {
    return { ok: false, error: "Failed to append data: " + error.message };
  }
}
