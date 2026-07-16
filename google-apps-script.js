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
    var isShopee = currentUrl.indexOf("shopee") !== -1 || currentUrl.indexOf("shope.ee") !== -1;
    var isLazada = currentUrl.indexOf("lazada") !== -1;
    if (!isShopee && !isLazada) return "";
    
    // === วิธีที่ 1: ติดตาม Redirect แล้วแกะชื่อจาก URL ยาว ===
    var options = {
      'followRedirects': false,
      'muteHttpExceptions': true
    };
    
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
    
    var decodedUrl = decodeURIComponent(currentUrl);
    var productName = "";
    
    // Shopee ลิงก์ยาว (มี -i. ในชื่อ)
    if (decodedUrl.indexOf("-i.") !== -1) {
      var parts = decodedUrl.split("/");
      var lastSegment = parts[parts.length - 1]; 
      productName = lastSegment.split("-i.")[0];
    } 
    // Lazada (มี /products/)
    else if (decodedUrl.indexOf("/products/") !== -1) {
      var parts = decodedUrl.split("/");
      var lastSegment = parts[parts.length - 1];
      productName = lastSegment.split("-i")[0];
    }
    
    if (productName) {
      return productName.replace(/-/g, " ").trim();
    }
    
    // === วิธีที่ 2 (Fallback สำหรับลิงก์สั้น Shopee): ===
    // ใช้ Facebookbot User-Agent เพื่อดึง og:title
    // เพราะ Shopee จะส่ง HTML พร้อมชื่อสินค้าให้ social media bots!
    if (isShopee) {
      return extractProductNameViaSocialBot(url.trim());
    }
    
    return "";
  } catch (e) {
    return "";
  }
}

// ฟังก์ชันดึงชื่อสินค้าผ่าน Social Bot User-Agent (Facebook/WhatsApp)
function extractProductNameViaSocialBot(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      'muteHttpExceptions': true,
      'followRedirects': true,
      'headers': {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html'
      }
    });
    
    var html = response.getContentText();
    
    // ค้นหา og:title ในผลลัพธ์ (รองรับทั้ง single/double quotes และการเรียงลำดับ property/content)
    var ogTitleMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                       html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
                       
    if (ogTitleMatch) {
      var title = ogTitleMatch[1];
      title = title.replace(/\s*\|\s*Shopee\s*Thailand\s*/gi, "").trim();
      return decodeHtmlEntities(title);
    }
    
    // ลอง title tag แทน
    var titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
      var title = titleMatch[1];
      title = title.replace(/\s*\|\s*Shopee\s*Thailand\s*/gi, "").trim();
      if (title && title !== "Shopee" && title.length > 3) {
        return decodeHtmlEntities(title);
      }
    }
    
    return "";
  } catch (e) {
    return "";
  }
}

// ฟังก์ชันแปลง HTML Entities ให้กลับเป็นอักษรปกติ
function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ฟังก์ชันสำหรับรันทดสอบใน Google Apps Script Editor เพื่อดู Log
function testAffiliateFetch() {
  var url = "https://s.shopee.co.th/111CGD5975";
  Logger.log("--- เริ่มการทดสอบดึงชื่อสินค้า ---");
  Logger.log("ลิงก์ทดสอบ: " + url);
  
  try {
    // 1. ลองทำตาม Redirect เพื่อดูปลายทาง
    var currentUrl = url;
    var options = {
      'followRedirects': false,
      'muteHttpExceptions': true
    };
    for (var i = 0; i < 5; i++) {
      var response = UrlFetchApp.fetch(currentUrl, options);
      var headers = response.getHeaders();
      var location = headers['Location'] || headers['location'];
      if (location) {
        currentUrl = location;
        Logger.log("Redirect " + (i+1) + " -> " + currentUrl);
      } else {
        break;
      }
    }
    
    // 2. ลอง fetch แบบ Social Bot
    Logger.log("กำลังเรียก URL ด้วย Social Bot User-Agent...");
    var botResponse = UrlFetchApp.fetch(url, {
      'muteHttpExceptions': true,
      'followRedirects': true,
      'headers': {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html'
      }
    });
    
    Logger.log("HTTP Status Code: " + botResponse.getResponseCode());
    var html = botResponse.getContentText();
    Logger.log("ความยาว HTML: " + html.length + " ตัวอักษร");
    Logger.log("ดู HTML 300 ตัวแรก: " + html.substring(0, 300));
    
    // ค้นหา og:title
    var ogTitleMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                       html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
    Logger.log("พบ og:title Match?: " + (ogTitleMatch ? "พบ -> " + ogTitleMatch[0] : "ไม่พบ"));
    if (ogTitleMatch) {
      Logger.log("เนื้อหาใน og:title: " + ogTitleMatch[1]);
    }
  } catch (err) {
    Logger.log("เกิดข้อผิดพลาดในการรัน: " + err.toString());
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
  
  // ตรวจสอบว่าแก้ไขในหน้า "Main Sheet" เสมอ
  if (sheet.getName() !== "Main Sheet") return;
  
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  
  // ข้ามแถวหัวตาราง (แถวที่ 1)
  if (startRow === 1) {
    if (numRows > 1) {
      startRow = 2;
      numRows--;
    } else {
      return;
    }
  }
  
  var ss = getSpreadsheet();
  var sheetPrem = ss.getSheetByName("Prem Sheet");
  var sheetHand = ss.getSheetByName("Hand Tools");
  if (!sheetPrem) return;
  
  // วนลูปประมวลผลทุกแถวที่มีการแก้ไข (รองรับการแก้ไข/วางข้อมูลหลายแถวพร้อมกัน)
  for (var r = 0; r < numRows; r++) {
    var currentRow = startRow + r;
    
    var tiktokLink = sheet.getRange(currentRow, 1).getValue().toString().trim();
    var shopLink = sheet.getRange(currentRow, 2).getValue().toString().trim();
    var productName = sheet.getRange(currentRow, 3).getValue().toString().trim();
    
    // ถ้าว่างหมดทั้ง TikTok Link และ Shopee Link ให้ข้ามไป
    if (!tiktokLink && !shopLink) continue;
    
    // 1. ค้นหาความซ้ำใน Prem Sheet ก่อนเพื่ออัปเดตแถวเดิม
    var premRow = findRowByLink(sheetPrem, tiktokLink, shopLink);
    if (premRow !== -1) {
      if (tiktokLink) sheetPrem.getRange(premRow, 1).setValue(tiktokLink);
      if (shopLink) sheetPrem.getRange(premRow, 2).setValue(shopLink);
      // อัปเดตชื่อสินค้า แม้ว่าชื่อสินค้าที่ได้มาจะเป็นค่าว่าง (เคลียร์ช่อง)
      sheetPrem.getRange(premRow, 3).setValue(productName);
      continue;
    }
    
    // 2. ถ้าไม่พบใน Prem Sheet ให้ค้นหาใน Hand Tools เผื่อว่าข้อมูลถูกจับคู่อยู่ที่นั่น
    if (sheetHand) {
      var handRow = findRowByLink(sheetHand, tiktokLink, shopLink);
      if (handRow !== -1) {
        if (tiktokLink) sheetHand.getRange(handRow, 1).setValue(tiktokLink);
        if (shopLink) sheetHand.getRange(handRow, 2).setValue(shopLink);
        sheetHand.getRange(handRow, 3).setValue(productName);
        continue;
      }
    }
    
    // 3. หากไม่พบลิงก์นี้ในหน้าใดเลย ให้เพิ่มเป็นแถวใหม่ (โดยดีฟอลต์จะเขียนเข้า Prem Sheet)
    var nextRow = getLastRowOfColA(sheetPrem) + 1;
    sheetPrem.getRange(nextRow, 1).setValue(tiktokLink);
    sheetPrem.getRange(nextRow, 2).setValue(shopLink);
    sheetPrem.getRange(nextRow, 3).setValue(productName);
  }
}

// ฟังก์ชันย่อยสำหรับค้นหาแถวจากลิงก์
function findRowByLink(targetSheet, tiktokLink, shopLink) {
  if (!tiktokLink && !shopLink) return -1;
  var values = targetSheet.getRange("A:B").getValues();
  for (var i = 0; i < values.length; i++) {
    var sheetTiktok = values[i][0] ? values[i][0].toString().trim() : "";
    var sheetShop = values[i][1] ? values[i][1].toString().trim() : "";
    
    if (tiktokLink && sheetTiktok === tiktokLink) {
      return i + 1; // ส่งคืนแถวแบบ 1-indexed
    }
    if (shopLink && sheetShop === shopLink) {
      return i + 1; // ส่งคืนแถวแบบ 1-indexed
    }
  }
  return -1;
}

// ============================================
// ส่วนที่ 2: doPost - รับข้อมูลจาก Web App
// ============================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var clipLink = data.clipLink;
    var shopLink = data.shopLink;
    var isHandTools = data.handTools === true;
    
    // แยก itemType ออกจาก prodName (หน้าเว็บจะส่งมาในรูปแบบ "ชื่อสินค้า|||Cookie")
    var rawProdName = data.prodName || "";
    var productName = "";
    var itemType = "";
    
    if (rawProdName.indexOf("|||") !== -1) {
      var parts = rawProdName.split("|||");
      productName = parts[0].trim() || extractProductName(shopLink);
      itemType = parts[1] ? parts[1].trim() : "";
    } else {
      productName = rawProdName || extractProductName(shopLink);
      // fallback: อ่าน itemType จาก URL parameter หรือ body โดยตรง
      if (e.parameter && e.parameter.itemType) {
        itemType = e.parameter.itemType;
      } else if (data.itemType) {
        itemType = data.itemType;
      }
    }
    
    var ss = getSpreadsheet();
    
    // 1. บันทึกลง Main Sheet (ทุกกรณี)
    var sheetMain = ss.getSheetByName("Main Sheet");
    if (sheetMain) {
      var lastRowInMain = getLastRowOfColA(sheetMain);
      var newRowMain = lastRowInMain + 1;
      sheetMain.getRange(newRowMain, 1).setValue(clipLink);
      sheetMain.getRange(newRowMain, 2).setValue(shopLink);
      sheetMain.getRange(newRowMain, 3).setValue(productName);
      sheetMain.getRange(newRowMain, 4).setValue(itemType); // คอลัมน์ D: Type of Item
    }
    
    // 2. บันทึกลง Sheet ที่สอง (ขึ้นอยู่กับ toggle)
    var secondSheetName = isHandTools ? "Hand Tools" : "Prem Sheet";
    var sheetSecond = ss.getSheetByName(secondSheetName);
    if (sheetSecond) {
      var lastRowInSecond = getLastRowOfColA(sheetSecond);
      var newRowSecond = lastRowInSecond + 1;
      sheetSecond.getRange(newRowSecond, 1).setValue(clipLink);
      sheetSecond.getRange(newRowSecond, 2).setValue(shopLink);
      sheetSecond.getRange(newRowSecond, 3).setValue(productName);
      sheetSecond.getRange(newRowSecond, 4).setValue(itemType); // คอลัมน์ D: Type of Item
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "บันทึกสำเร็จ",
      productName: productName,
      targetSheet: secondSheetName
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
  if (e && e.parameter && e.parameter.action === "extractName") {
    try {
      var url = e.parameter.url;
      var name = extractProductName(url);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        productName: name
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Record Affiliate API is running!"
  })).setMimeType(ContentService.MimeType.JSON);
}
