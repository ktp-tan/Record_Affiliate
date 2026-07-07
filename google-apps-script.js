// ============================================
// Google Apps Script สำหรับ Record Affiliate
// ============================================
// วิธีติดตั้ง:
// 1. เปิด Google Sheet "GodofAff Sheet"
// 2. ไปที่ Extensions (ส่วนขยาย) > Apps Script
// 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้แทน
// 4. *** เลือกฟังก์ชัน setup ในเมนูด้านบน แล้วกดปุ่ม "เรียกใช้" (Run) 1 ครั้ง ***
//    (เพื่อบันทึก ID ของชีตนี้เข้าระบบอัตโนมัติ)
// 5. กด Save (บันทึก)
// 6. กด Deploy (ทำให้ใช้งานได้) > New Deployment
// 7. เลือก Type: Web app
//    - Execute as: Me (ตัวเอง)
//    - Who has access: Anyone (ทุกคน)
// 8. กด Deploy แล้วคัดลอก URL
// ============================================

// คัดลอก ID จาก URL ของชีตมาใส่ตรงนี้ได้เลย (เผื่อกรณีฟังก์ชัน setup ทำงานไม่สำเร็จ)
// ตัวอย่าง URL: https://docs.google.com/spreadsheets/d/ใส่_ID_ตรงนี้/edit
var SPREADSHEET_ID = ""; 

// ฟังก์ชันดึง Spreadsheet อย่างปลอดภัยในระบบ Web App
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  
  var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {}
  }
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      return ss;
    }
  } catch (e) {}
  
  throw new Error("กรุณาเปิดหน้า Apps Script แล้วเลือกฟังก์ชัน setup จากนั้นกดปุ่ม 'เรียกใช้' (Run) 1 ครั้ง");
}

// ฟังก์ชันตั้งค่าอัตโนมัติ (ให้กด Run 1 ครั้งในหน้านี้ตอนติดตั้งโค้ดครั้งแรก)
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var id = ss.getId();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
    Logger.log("ตั้งค่าเรียบร้อย! Spreadsheet ID ของคุณคือ: " + id);
  } else {
    Logger.log("ข้อผิดพลาด: ไม่พบชีตที่เปิดอยู่");
  }
}

// ============================================
// ส่วนที่ 1: โค้ดเดิมของคุณ - onEdit
// ============================================
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  
  if (sheet.getName() === "Main Sheet" && range.getRow() > 1 && (range.getColumn() === 1 || range.getColumn() === 2)) {
    var ss = getSpreadsheet();
    var targetSheet = ss.getSheetByName("Prem Sheet");
    if (!targetSheet) return;
    
    var row = range.getRow();
    var tiktokLink = sheet.getRange(row, 1).getValue();
    var shopeeLink = sheet.getRange(row, 2).getValue();
    
    if (tiktokLink || shopeeLink) {
      var nextRow = targetSheet.getRange("A:A").getValues().filter(String).length + 1;
      targetSheet.getRange(nextRow, 1).setValue(tiktokLink);
      targetSheet.getRange(nextRow, 2).setValue(shopeeLink);
    }
  }
}

// ============================================
// ส่วนที่ 2: doPost - รับข้อมูลจาก Web App
// ============================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var clipLink = data.clipLink;
    var shopLink = data.shopLink;
    var sheetName = "Main Sheet"; // ส่งไปที่ Main Sheet เท่านั้น
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "ไม่พบ Sheet ชื่อ: " + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var lastRow = sheet.getLastRow();
    var newRow = lastRow + 1;
    
    if (lastRow === 0) {
      newRow = 2; 
    }
    
    sheet.getRange(newRow, 1).setValue(clipLink);  // Column A
    sheet.getRange(newRow, 2).setValue(shopLink);  // Column B
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "บันทึกสำเร็จ",
      row: newRow,
      sheet: sheetName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", 
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// ส่วนที่ 3: doGet - สำหรับทดสอบว่า script ทำงานได้
// ============================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Record Affiliate API is running!"
  })).setMimeType(ContentService.MimeType.JSON);
}
