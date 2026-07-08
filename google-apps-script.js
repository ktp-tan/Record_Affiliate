// ============================================
// Google Apps Script สำหรับ Record Affiliate (เวอร์ชันสมบูรณ์ ดึงชื่อสินค้าอัตโนมัติ)
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

// ฟังก์ชันหาแถวสุดท้ายที่มีข้อมูลจริงในคอลัมน์ A (ป้องกัน Checkbox เปล่าดันข้อมูลลงล่าง)
function getLastRowOfColA(sheet) {
  var values = sheet.getRange("A:A").getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "") {
      return i + 1; // คืนค่าแถว (เริ่มนับจาก 1)
    }
  }
  return 1; // ถ้าไม่มีข้อมูลเลย ให้เริ่มเขียนที่แถวที่ 2
}

// ฟังก์ชันแกะชื่อสินค้าจากลิงก์ Shopee หรือ Lazada
function extractProductName(url) {
  if (!url) return "";
  try {
    var currentUrl = url.trim();
    
    // กรองเฉพาะ Shopee หรือ Lazada
    if (currentUrl.indexOf("shopee") === -1 && currentUrl.indexOf("lazada") === -1 && currentUrl.indexOf("shope.ee") === -1) {
      return "";
    }
    
    var options = {
      'followRedirects': false,
      'muteHttpExceptions': true
    };
    
    // วนลูปติดตาม Redirect (กรณีเป็นลิงก์ย่อ เช่น s.shopee.co.th / s.lazada.co.th) เพื่อดึงลิงก์ยาว
    for (var i = 0; i < 5; i++) {
      var response = UrlFetchApp.fetch(currentUrl, options);
      var headers = response.getHeaders();
      var location = headers['Location'] || headers['location'];
      if (location) {
        currentUrl = location;
      } else {
        break;
      }
    }
    
    // แปลงรหัสอักขระ URL ให้กลับเป็นภาษาไทย
    var decodedUrl = decodeURIComponent(currentUrl);
    var productName = "";
    
    // 1. กรณีเป็น Shopee (ดึงชื่อก่อนคำว่า -i.)
    if (decodedUrl.indexOf("-i.") !== -1) {
      var parts = decodedUrl.split("/");
      var lastSegment = parts[parts.length - 1]; 
      productName = lastSegment.split("-i.")[0];
    } 
    // 2. กรณีเป็น Lazada (ดึงชื่อก่อนคำว่า -i)
    else if (decodedUrl.indexOf("/products/") !== -1) {
      var parts = decodedUrl.split("/");
      var lastSegment = parts[parts.length - 1];
      productName = lastSegment.split("-i")[0];
    }
    
    if (productName) {
      // เปลี่ยนเครื่องหมายขีดกลาง (-) ให้เป็นเว้นวรรค
      return productName.replace(/-/g, " ").trim();
    }
    
    return "";
  } catch (e) {
    return "";
  }
}

// ฟังก์ชันดึง Spreadsheet
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
  
  throw new Error("กรุณาเลือกฟังก์ชัน setup จากนั้นกดปุ่ม 'เรียกใช้' (Run) 1 ครั้ง");
}

// ฟังก์ชันตั้งค่าอัตโนมัติ
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
// ส่วนที่ 1: onEdit (สำหรับการพิมพ์แก้ไขข้อมูลในตารางตรงๆ)
// ============================================
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  
  if (sheet.getName() === "Main Sheet" && range.getRow() > 1 && (range.getColumn() === 1 || range.getColumn() === 2 || range.getColumn() === 3)) {
    var ss = getSpreadsheet();
    var targetSheet = ss.getSheetByName("Prem Sheet");
    if (!targetSheet) return;
    
    var row = range.getRow();
    var tiktokLink = sheet.getRange(row, 1).getValue();
    var shopeeLink = sheet.getRange(row, 2).getValue();
    var productName = sheet.getRange(row, 3).getValue();
    
    if (tiktokLink || shopeeLink) {
      var nextRow = targetSheet.getRange("A:A").getValues().filter(String).length + 1;
      targetSheet.getRange(nextRow, 1).setValue(tiktokLink);
      targetSheet.getRange(nextRow, 2).setValue(shopeeLink);
      targetSheet.getRange(nextRow, 3).setValue(productName);
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
    
    // ดึงชื่อสินค้า: ใช้จากที่หน้าเว็บส่งมาให้ก่อน ถ้าไม่มีค่อยแกะจากลิงก์
    var productName = data.prodName || extractProductName(shopLink);
    
    var ss = getSpreadsheet();
    
    // 1. บันทึกลง Main Sheet
    var sheetMain = ss.getSheetByName("Main Sheet");
    if (sheetMain) {
      var lastRowInMain = getLastRowOfColA(sheetMain);
      var newRowMain = lastRowInMain + 1;
      sheetMain.getRange(newRowMain, 1).setValue(clipLink);
      sheetMain.getRange(newRowMain, 2).setValue(shopLink);
      sheetMain.getRange(newRowMain, 3).setValue(productName); // คอลัมน์ C ชื่อสินค้า
    }
    
    // 2. บันทึกลง Prem Sheet
    var sheetPrem = ss.getSheetByName("Prem Sheet");
    if (sheetPrem) {
      var lastRowInPrem = getLastRowOfColA(sheetPrem);
      var newRowPrem = lastRowInPrem + 1;
      sheetPrem.getRange(newRowPrem, 1).setValue(clipLink);
      sheetPrem.getRange(newRowPrem, 2).setValue(shopLink);
      sheetPrem.getRange(newRowPrem, 3).setValue(productName); // คอลัมน์ C ชื่อสินค้า
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "บันทึกสำเร็จ",
      productName: productName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", 
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// ส่วนที่ 3: doGet
// ============================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Record Affiliate API is running!"
  })).setMimeType(ContentService.MimeType.JSON);
}
