// ============================================
// Google Apps Script สำหรับ Record Affiliate
// ============================================
// วิธีติดตั้ง:
// 1. เปิด Google Sheet "GodofAff Sheet"
// 2. ไปที่ Extensions (ส่วนขยาย) > Apps Script
// 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้แทน
// 4. กด Save (บันทึก)
// 5. กด Deploy (ทำให้ใช้งานได้) > New Deployment
// 6. เลือก Type: Web app
// 7. ตั้งค่า:
//    - Description: Record Affiliate API
//    - Execute as: Me (ตัวเอง)
//    - Who has access: Anyone (ทุกคน)
// 8. กด Deploy
// 9. คัดลอก URL ที่ได้ไปวางในเว็บแอป
// ============================================


// ============================================
// ส่วนที่ 1: โค้ดเดิมของคุณ - onEdit
// เมื่อพิมพ์ใน Main Sheet จะ copy ไปลง Prem Sheet อัตโนมัติ
// ============================================

function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  
  // ตรวจสอบว่าเป็นหน้า "Main Sheet" และแก้ไขในคอลัมน์ A หรือ B
  if (sheet.getName() === "Main Sheet" && range.getRow() > 1 && (range.getColumn() === 1 || range.getColumn() === 2)) {
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetSheet = ss.getSheetByName("Prem Sheet");
    if (!targetSheet) return;
    
    var row = range.getRow();
    
    // ดึงค่าลิงก์จากแถวที่พิมพ์ใน Main Sheet
    var tiktokLink = sheet.getRange(row, 1).getValue();
    var shopeeLink = sheet.getRange(row, 2).getValue();
    
    // ทำงานเฉพาะเมื่อข้อมูลในคอลัมน์ A หรือ B ไม่ว่าง
    if (tiktokLink || shopeeLink) {
      
      // หาแถวว่างถัดไปใน Prem Sheet โดยดูจากคอลัมน์ A
      var nextRow = targetSheet.getRange("A:A").getValues().filter(String).length + 1;
      
      // ส่งค่าไปลงในแถวว่างล่าสุดของ Prem Sheet
      targetSheet.getRange(nextRow, 1).setValue(tiktokLink);
      targetSheet.getRange(nextRow, 2).setValue(shopeeLink);
    }
  }
}


// ============================================
// ส่วนที่ 2: doPost - รับข้อมูลจาก Web App
// เมื่อกดบันทึกจากเว็บ จะเพิ่มข้อมูลลงท้ายสุดของ Sheet ที่เลือก
// ============================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var clipLink = data.clipLink;
    var shopLink = data.shopLink;
    var sheetName = data.sheet || "Main Sheet";
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "ไม่พบ Sheet ชื่อ: " + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // หาแถวสุดท้ายที่มีข้อมูลในคอลัมน์ A
    var lastRow = sheet.getLastRow();
    var newRow = lastRow + 1;
    
    // ถ้าแถวแรกเป็น header (Tiktok Link, Shopee Link) 
    // และไม่มีข้อมูลเลย ให้เริ่มที่แถว 2
    if (lastRow === 0) {
      newRow = 2; // ข้ามแถว header
    }
    
    // เขียนข้อมูลลงคอลัมน์ A และ B
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
