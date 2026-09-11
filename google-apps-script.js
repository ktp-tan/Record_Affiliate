// ============================================
// Google Apps Script สำหรับ Record Affiliate (เวอร์ชันดึงชื่อสินค้าผ่าน Worker Scraper v3.14.0)
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

// Worker Scraper URL จากระบบ AutopostTool (ดึงข้อมูลสินค้า Shopee แม่นยำ 100% ไม่โดนบล็อก)
var WORKER_SCRAPER_URL = "https://9d9f405b-kaneskn-worker.p2scalworkhost.workers.dev/api/scrape-product"; 

// ฟังก์ชันหาแถวสุดท้ายที่มีข้อมูลจริงในคอลัมน์ A (ป้องกัน Checkbox เปล่าดันข้อมูลลงล่าง)
function getLastRowOfColA(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return 1;
  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "") {
      return i + 1;
    }
  }
  return 1;
}

// ฟังก์ชันแกะชื่อสินค้าจากลิงก์ Shopee หรือ Lazada
function extractProductName(url, debugLogs) {
  if (!url) return "";
  debugLogs = debugLogs || [];
  try {
    var currentUrl = url.trim();
    debugLogs.push("Original URL: " + currentUrl);
    
    // กรองเฉพาะ Shopee หรือ Lazada
    var isShopee = currentUrl.indexOf("shopee") !== -1 || currentUrl.indexOf("shope.ee") !== -1 || currentUrl.indexOf("shp.ee") !== -1;
    var isLazada = currentUrl.indexOf("lazada") !== -1;
    if (!isShopee && !isLazada) return "";
    
    // === วิธีที่ 1: ติดตาม Redirect แล้วแกะชื่อจาก URL หรือ IDs ===
    var options = {
      'followRedirects': false,
      'muteHttpExceptions': true,
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };
    
    for (var i = 0; i < 6; i++) {
      var response = UrlFetchApp.fetch(currentUrl, options);
      var code = response.getResponseCode();
      var headers = response.getHeaders();
      debugLogs.push("Step " + (i+1) + " status=" + code + " for " + currentUrl);
      
      var location = null;
      for (var key in headers) {
        if (key.toLowerCase() === 'location') {
          location = headers[key];
          break;
        }
      }
      
      // ถ้า header ไม่มี Location ลองควานหา href ใน HTML body
      if (!location) {
        var content = response.getContentText();
        var matchHref = content.match(/href=["'](https?:\/\/[^"']+)["']/i) ||
                        content.match(/href=["'](\/[^"']+)["']/i);
        if (matchHref) {
          location = matchHref[1].replace(/&amp;/g, "&");
          debugLogs.push("Found href in body: " + location.substring(0, 80));
        }
      }
      
      if (location) {
        if (location.indexOf("http") !== 0) {
          location = "https://shopee.co.th" + (location.indexOf("/") === 0 ? "" : "/") + location;
        }
        currentUrl = location;
        debugLogs.push("Redirecting to: " + currentUrl.substring(0, 100));
      } else {
        break;
      }
    }
    
    var decodedUrl = decodeURIComponent(currentUrl);
    debugLogs.push("Final Decoded URL: " + decodedUrl.substring(0, 100));
    
    // กรณีที่ 1: Shopee ลิงก์ยาวที่มี slug ชื่อสินค้า (มี -i.)
    if (decodedUrl.indexOf("-i.") !== -1) {
      var parts = decodedUrl.split("/");
      var lastSegment = parts[parts.length - 1]; 
      var rawSlug = lastSegment.split("-i.")[0];
      if (rawSlug && rawSlug.length > 2 && rawSlug.indexOf("opaanlp") === -1) {
        var slugTitle = rawSlug.replace(/-/g, " ").trim();
        debugLogs.push("Found slug title: " + slugTitle);
        return slugTitle;
      }
    } 
    
    // กรณีที่ 2: Shopee ลิงก์สั้นที่ redirect มาเป็น opaanlp/shopId/itemId หรือ product/shopId/itemId
    if (isShopee) {
      var shopId = null;
      var itemId = null;
      
      var opaanlpMatch = decodedUrl.match(/opaanlp\/(\d+)\/(\d+)/i);
      if (opaanlpMatch) {
        shopId = opaanlpMatch[1];
        itemId = opaanlpMatch[2];
      }
      if (!shopId) {
        var prodMatch = decodedUrl.match(/product\/(\d+)\/(\d+)/i);
        if (prodMatch) {
          shopId = prodMatch[1];
          itemId = prodMatch[2];
        }
      }
      if (!shopId) {
        var iMatch = decodedUrl.match(/-i\.(\d+)\.(\d+)/i);
        if (iMatch) {
          shopId = iMatch[1];
          itemId = iMatch[2];
        }
      }
      if (!shopId) {
        var slashMatch = decodedUrl.match(/\/(\d{5,})\/(\d{5,})/);
        if (slashMatch) {
          shopId = slashMatch[1];
          itemId = slashMatch[2];
        }
      }
      
      debugLogs.push("Extracted IDs: shopId=" + shopId + ", itemId=" + itemId);
      
      if (shopId && itemId) {
        var productPageUrl = "https://shopee.co.th/product/" + shopId + "/" + itemId;
        
        // 2.1 ดึงผ่าน Cloudflare Worker Scraper จากโปรเจกต์ AutopostTool (ได้ผล 100% ไม่โดนบล็อก)
        try {
          var workerRes = UrlFetchApp.fetch(WORKER_SCRAPER_URL, {
            'method': 'post',
            'contentType': 'application/json',
            'muteHttpExceptions': true,
            'payload': JSON.stringify({ productUrl: productPageUrl })
          });
          var wCode = workerRes.getResponseCode();
          debugLogs.push("Worker response status: " + wCode);
          if (wCode === 200) {
            var workerData = JSON.parse(workerRes.getContentText());
            debugLogs.push("Worker success: " + (workerData ? workerData.success : false) + ", title: " + (workerData ? workerData.title : ""));
            if (workerData && workerData.success && workerData.title) {
              var title = workerData.title.replace(/\s*\|\s*Shopee\s*Thailand\s*/gi, "").trim();
              if (title && title !== "Shopee" && title.length > 2) {
                return decodeHtmlEntities(title);
              }
            }
          }
        } catch (we) {
          debugLogs.push("Worker Scrape Error: " + we.toString());
        }
        
        // 2.2 Fallback: Fetch หน้า Canonical Product Page ด้วย Desktop Chrome
        try {
          var pageRes = UrlFetchApp.fetch(productPageUrl, {
            'muteHttpExceptions': true,
            'followRedirects': true,
            'headers': {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8'
            }
          });
          var pageHtml = pageRes.getContentText();
          var ogTitleMatch = pageHtml.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                             pageHtml.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
          var titleTagMatch = pageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          var foundTitle = ogTitleMatch ? ogTitleMatch[1] : (titleTagMatch ? titleTagMatch[1] : "");
          if (foundTitle) {
            foundTitle = foundTitle.replace(/\s*\|\s*Shopee\s*Thailand\s*/gi, "").trim();
            if (foundTitle && foundTitle !== "Shopee" && foundTitle.length > 2) {
              return decodeHtmlEntities(foundTitle);
            }
          }
        } catch (pe) {}
      }
    }
    
    // กรณีที่ 3: Lazada (มี /products/)
    if (decodedUrl.indexOf("/products/") !== -1) {
      var lzParts = decodedUrl.split("/");
      var lzLastSegment = lzParts[lzParts.length - 1];
      var lzName = lzLastSegment.split("-i")[0];
      if (lzName) {
        return lzName.replace(/-/g, " ").trim();
      }
    }
    
    // === วิธีที่ 3: Fallback Social Bot ===
    return extractProductNameViaSocialBot(currentUrl) || extractProductNameViaSocialBot(url.trim());
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
  
  // ข้ามหากเป็นการแก้ไขคอลัมน์อื่นที่ไม่ใช่ A, B, C, D (เช่น การติ๊ก Checkbox ในคอลัมน์ E, F)
  // เพื่อป้องกันไม่ให้แถวที่ลบไปจาก Prem Sheet เด้งกลับมาเมื่อมีการคลิกติ๊กถูกใน Main Sheet
  var startCol = range.getColumn();
  if (startCol > 4) return;
  
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
  
  var sheetPremValues = sheetPrem.getRange("A:B").getValues();
  var sheetHandValues = sheetHand ? sheetHand.getRange("A:B").getValues() : [];
  var editedData = sheet.getRange(startRow, 1, numRows, 4).getValues();
  
  // วนลูปประมวลผลทุกแถวที่มีการแก้ไข (รองรับการแก้ไข/วางข้อมูลหลายแถวพร้อมกัน)
  for (var r = 0; r < numRows; r++) {
    var currentRow = startRow + r;
    
    var tiktokLink = String(editedData[r][0] || "").trim();
    var shopLink = String(editedData[r][1] || "").trim();
    var productName = String(editedData[r][2] || "").trim();
    var itemType = String(editedData[r][3] || "").trim(); // คอลัมน์ D: Type of Item
    
    // ถ้าว่างหมดทั้ง TikTok Link และ Shopee Link ให้ข้ามไป
    if (!tiktokLink && !shopLink) continue;
    
    // 1. ค้นหาความซ้ำใน Prem Sheet ก่อนเพื่ออัปเดตแถวเดิม
    var premRow = findRowByLink(sheetPremValues, tiktokLink, shopLink);
    if (premRow !== -1) {
      if (tiktokLink) sheetPrem.getRange(premRow, 1).setValue(tiktokLink);
      if (shopLink) sheetPrem.getRange(premRow, 2).setValue(shopLink);
      sheetPrem.getRange(premRow, 3).setValue(productName);
      sheetPrem.getRange(premRow, 4).setValue(itemType); // อัปเดต Column D ใน Prem Sheet
      continue;
    }
    
    // 2. ถ้าไม่พบใน Prem Sheet ให้ค้นหาใน Hand Tools เผื่อว่าข้อมูลถูกจับคู่อยู่ที่นั่น
    if (sheetHand) {
      var handRow = findRowByLink(sheetHandValues, tiktokLink, shopLink);
      if (handRow !== -1) {
        if (tiktokLink) sheetHand.getRange(handRow, 1).setValue(tiktokLink);
        if (shopLink) sheetHand.getRange(handRow, 2).setValue(shopLink);
        sheetHand.getRange(handRow, 3).setValue(productName);
        sheetHand.getRange(handRow, 4).setValue(itemType); // อัปเดต Column D ใน Hand Tools
        continue;
      }
    }
    
    // 3. หากไม่พบลิงก์นี้ในหน้าใดเลย ให้เพิ่มเป็นแถวใหม่ (โดยดีฟอลต์จะเขียนเข้า Prem Sheet)
    var nextRow = getLastRowOfColA(sheetPrem) + 1;
    sheetPrem.getRange(nextRow, 1).setValue(tiktokLink);
    sheetPrem.getRange(nextRow, 2).setValue(shopLink);
    sheetPrem.getRange(nextRow, 3).setValue(productName);
    sheetPrem.getRange(nextRow, 4).setValue(itemType); // บันทึก Column D ใน Prem Sheet ด้วย
  }
}

// ฟังก์ชันย่อยสำหรับค้นหาแถวจากลิงก์
function findRowByLink(values, tiktokLink, shopLink) {
  if (!tiktokLink && !shopLink) return -1;
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
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for lock
    
    try {
      var data = JSON.parse(e.postData.contents);
      var clipLink = data.clipLink;
      var shopLink = data.shopLink;
      var isHandTools = data.handTools === true;
      
      // แยก itemType และ PS Mode ออกจาก prodName (หน้าเว็บจะส่งมาในรูปแบบ "ชื่อสินค้า|||Cookie|||PS")
      var rawProdName = data.prodName || "";
      var productName = "";
      var itemType = "";
      var isPremSearch = data.premSearch === true || (e.parameter && e.parameter.premSearch === "true");
      
      if (rawProdName.indexOf("|||") !== -1) {
        var parts = rawProdName.split("|||");
        productName = parts[0].trim() || extractProductName(shopLink);
        itemType = parts[1] ? parts[1].trim() : "";
        if (parts[2] && parts[2].trim() === "PS") {
          isPremSearch = true;
        }
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
      var sheetMain = ss.getSheetByName("Main Sheet");
      
      // ถ้าไม่ได้ส่ง shopLink มา (เว้นว่างไว้) ให้ดึง shopLink และชื่อสินค้าจากแถวล่าสุดของ Main Sheet อัตโนมัติ
      if (!shopLink && sheetMain) {
        var prevRow = getLastRowOfColA(sheetMain);
        if (prevRow >= 2) {
          var prevShop = String(sheetMain.getRange(prevRow, 2).getValue() || "").trim();
          if (prevShop) {
            shopLink = prevShop;
            if (!productName) {
              productName = String(sheetMain.getRange(prevRow, 3).getValue() || "").trim();
            }
          }
        }
      }
      
      // 1. บันทึกลง Main Sheet (ทุกกรณี)
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
        
        // ถ้าเปิดใช้งาน PS Mode และบันทึกลง Prem Sheet ให้เพิ่มคำว่า "PS" ในคอลัมน์ K (คอลัมน์ที่ 11)
        if (secondSheetName === "Prem Sheet" && isPremSearch) {
          sheetSecond.getRange(newRowSecond, 11).setValue("PS");
        }
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
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", 
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ============================================
// ส่วนที่ 3: doGet
// ============================================
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "extractName") {
    try {
      var url = e.parameter.url;
      var debugLogs = [];
      // Domain whitelist to prevent SSRF
      var allowedDomains = ["shopee.co.th", "shope.ee", "shp.ee", "th.shp.ee", "lazada.co.th", "s.shopee.co.th", "vt.tiktok.com", "www.tiktok.com", "www.instagram.com"];
      var isAllowed = false;
      if (url) {
        for (var d = 0; d < allowedDomains.length; d++) {
          if (url.indexOf(allowedDomains[d]) !== -1) {
            isAllowed = true;
            break;
          }
        }
      }
      if (!isAllowed) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "URL domain not allowed"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var name = extractProductName(url, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        productName: name,
        debug: debugLogs
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
    message: "Record Affiliate API is running! (v3.14.0)"
  })).setMimeType(ContentService.MimeType.JSON);
}
