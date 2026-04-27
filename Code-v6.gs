// ═══════════════════════════════════════════════════════════
// Mentora Document Portal — Google Apps Script Backend (Anti-Crash Version)
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  SPREADSHEET_ID: '1xIwmIvmpXxnZzRM453pbhLtBF1grvU1cRXVf8Yp-0eE',
  PAYEES_SHEET: 'Payees',
  DOCUMENTS_SHEET: 'Documents',
  PROJECTS_SHEET: 'Project list',
  DRIVE_FOLDER_ID: '1fj3ihcnss0R7_P-y_bAb0pkpxccwb6KH',
  ADMIN_PASSKEY: 'mentora-admin-2026',
  SESSION_TIMEOUT_MINUTES: 30,
};

let _ss = null;
function getSS() {
  if (!_ss) _ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return _ss;
}

function getOptimizedData(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  let lastIndex = data.length - 1;
  while (lastIndex >= 1 && String(data[lastIndex][0]).trim() === '') {
    lastIndex--;
  }
  return data.slice(0, lastIndex + 1);
}

function safeVal(val, isDate = false, format = 'yyyy-MM-dd') {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return isDate ? Utilities.formatDate(val, 'Asia/Bangkok', format) : String(val);
  }
  const s = String(val).trim();
  // Normalize period strings that arrive as "YYYY-M" → "YYYY-MM"
  if (isDate && format === 'yyyy-MM') {
    const m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0');
  }
  return s;
}

function loadAllData() {
  const ss = getSS();
  const payeeSheet = ss.getSheetByName(CONFIG.PAYEES_SHEET);
  const docSheet   = ss.getSheetByName(CONFIG.DOCUMENTS_SHEET);
  
  const payeeData = getOptimizedData(payeeSheet);
  const docData   = getOptimizedData(docSheet);
  
  const payeeNameMap = {};
  for (let i = 1; i < payeeData.length; i++) {
    payeeNameMap[safeVal(payeeData[i][0])] = safeVal(payeeData[i][2]);
  }

  // Load projects from "Project list" tab
  const projSheet = ss.getSheetByName(CONFIG.PROJECTS_SHEET);
  const projData = getOptimizedData(projSheet);
  const projectsList = [];
  for (let i = 1; i < projData.length; i++) {
    const name = safeVal(projData[i][0]);
    if (!name) continue;
    projectsList.push({
      name: name,
      date: safeVal(projData[i][1], true, 'yyyy-MM-dd'),
      billingClient: safeVal(projData[i][2]),
      endClient: safeVal(projData[i][3]),
    });
  }

  const docCounts = {};
  const latestPeriods = {};
  const documents = [];

  for (let i = 1; i < docData.length; i++) {
    const tid = safeVal(docData[i][0]);
    if (!tid) continue;
    const fileId   = safeVal(docData[i][5]);
    const filename = safeVal(docData[i][4]);
    const ext      = filename.split('.').pop().toLowerCase();
    const isImage  = ['png','jpg','jpeg','gif','webp','bmp','svg'].indexOf(ext) >= 0;
    const proj     = safeVal(docData[i][9]);
    const period   = safeVal(docData[i][3], true, 'yyyy-MM'); 
    
    docCounts[tid] = (docCounts[tid] || 0) + 1;
    if (!latestPeriods[tid] || period > latestPeriods[tid]) latestPeriods[tid] = period;
    
    documents.push({
      rowIndex:     i + 1,
      taxId:        tid,
      payeeName:    safeVal(docData[i][1]),
      type:         safeVal(docData[i][2]) || 'other',
      period:       period,
      filename:     filename,
      fileId:       fileId,
      downloadUrl:  fileId ? 'https://drive.google.com/uc?export=download&id=' + fileId : '',
      viewUrl:      fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : '',
      thumbnailUrl: isImage && fileId ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400' : '',
      isImage:      isImage,
      visibility:   safeVal(docData[i][10]) || 'payee',
      project:      proj,
      date:         safeVal(docData[i][6], true, 'yyyy-MM-dd'),
      size:         safeVal(docData[i][7]),
      notes:        safeVal(docData[i][8]),
    });
  }

  const payees = [];
  for (let i = 1; i < payeeData.length; i++) {
    const tid = safeVal(payeeData[i][0]);
    if (!tid) continue;
    payees.push({
      taxId:        tid,
      pref:         safeVal(payeeData[i][1]),
      name:         safeVal(payeeData[i][2]),
      name_en:      safeVal(payeeData[i][3]),
      codename:     safeVal(payeeData[i][4]),
      address:      safeVal(payeeData[i][5]),
      bank:         safeVal(payeeData[i][6]),
      branch:       safeVal(payeeData[i][7]),
      accountNo:    safeVal(payeeData[i][8]),
      docCount:     docCounts[tid] || 0,
      latestPeriod: latestPeriods[tid] || '',
    });
  }

  return { payees: payees, documents: documents, projects: projectsList };
}

function doGet(e) {
  const page = (e && e.parameter && e.parameter.p) || 'admin';
  const isPortal = (page === 'portal');
  let template = HtmlService.createTemplateFromFile(isPortal ? 'Portal' : 'Admin');
  template.scriptUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle(isPortal ? 'Mentora Document Portal' : 'Mentora Admin Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function verifyPasskey(passkey) {
  if (passkey === CONFIG.ADMIN_PASSKEY) {
    const token = Utilities.getUuid();
    CacheService.getUserCache().put('admin_session_' + token, 'active', CONFIG.SESSION_TIMEOUT_MINUTES * 60);
    return { success: true, token: token };
  }
  return { success: false };
}

function portalLogin(taxId) {
  const ss = getSS();
  const data = getOptimizedData(ss.getSheetByName(CONFIG.PAYEES_SHEET));
  for (let i = 1; i < data.length; i++) {
    if (safeVal(data[i][0]) === safeVal(taxId)) {
      const payee = {
        taxId: safeVal(data[i][0]), pref: safeVal(data[i][1]), name: safeVal(data[i][2]), 
        name_en: safeVal(data[i][3]), codename: safeVal(data[i][4]),
      };
      const docData = getOptimizedData(ss.getSheetByName(CONFIG.DOCUMENTS_SHEET));
      const docs = [];
      for (let j = 1; j < docData.length; j++) {
        const vis = safeVal(docData[j][10]) || 'payee';
        if (safeVal(docData[j][0]) === safeVal(taxId) && vis !== 'admin') {
          const fileId = safeVal(docData[j][5]);
          const filename = safeVal(docData[j][4]);
          const ext = filename.split('.').pop().toLowerCase();
          const isImage = ['png','jpg','jpeg','gif','webp','bmp','svg'].indexOf(ext) >= 0;
          docs.push({
            type: safeVal(docData[j][2]), period: safeVal(docData[j][3], true, 'yyyy-MM'),
            filename: filename, fileId: fileId,
            downloadUrl: fileId ? 'https://drive.google.com/uc?export=download&id=' + fileId : '',
            viewUrl: fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : '',
            thumbnailUrl: isImage && fileId ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400' : '',
            isImage: isImage, visibility: vis, project: safeVal(docData[j][9]),
            date: safeVal(docData[j][6], true, 'yyyy-MM-dd'), size: safeVal(docData[j][7]),
          });
        }
      }
      return { success: true, payee: payee, documents: docs };
    }
  }
  return { success: false, error: 'NOT_FOUND' };
}

function addPayee(payeeData) {
  const sheet = getSS().getSheetByName(CONFIG.PAYEES_SHEET);
  const data = getOptimizedData(sheet);
  for (let i = 1; i < data.length; i++) {
    if (safeVal(data[i][0]) === safeVal(payeeData.taxId)) return { success: false, error: 'DUPLICATE' };
  }
  sheet.appendRow([payeeData.taxId, payeeData.pref, payeeData.name, payeeData.name_en, payeeData.codename, payeeData.address, payeeData.bank, payeeData.branch, payeeData.accountNo]);
  return { success: true };
}

function updatePayee(payeeData) {
  const sheet = getSS().getSheetByName(CONFIG.PAYEES_SHEET);
  const data = getOptimizedData(sheet);
  for (let i = 1; i < data.length; i++) {
    if (safeVal(data[i][0]) === safeVal(payeeData.taxId)) {
      const row = i + 1;
      sheet.getRange(row, 2).setValue(payeeData.pref); sheet.getRange(row, 3).setValue(payeeData.name);
      sheet.getRange(row, 4).setValue(payeeData.name_en); sheet.getRange(row, 5).setValue(payeeData.codename);
      sheet.getRange(row, 6).setValue(payeeData.address); sheet.getRange(row, 7).setValue(payeeData.bank);
      sheet.getRange(row, 8).setValue(payeeData.branch); sheet.getRange(row, 9).setValue(payeeData.accountNo);
      return { success: true };
    }
  }
  return { success: false, error: 'NOT_FOUND' };
}

function addProject(projectData) {
  const sheet = getSS().getSheetByName(CONFIG.PROJECTS_SHEET);
  const data = getOptimizedData(sheet);
  for (let i = 1; i < data.length; i++) {
    if (safeVal(data[i][0]).toLowerCase() === safeVal(projectData.name).toLowerCase()) {
      return { success: false, error: 'DUPLICATE' };
    }
  }
  sheet.appendRow([projectData.name, projectData.date || '', projectData.billingClient || '', projectData.endClient || '']);
  return { success: true };
}

function uploadDocument(docData, fileBlob) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  let targetFolder = folder;
  if (docData.taxId) {
    const taxFolders = folder.getFoldersByName(docData.taxId);
    targetFolder = taxFolders.hasNext() ? taxFolders.next() : folder.createFolder(docData.taxId);
    if (docData.project) {
      const projFolders = targetFolder.getFoldersByName(docData.project);
      targetFolder = projFolders.hasNext() ? projFolders.next() : targetFolder.createFolder(docData.project);
    }
    if (docData.visibility === 'admin') {
      const adminFolders = targetFolder.getFoldersByName('admin_only');
      targetFolder = adminFolders.hasNext() ? adminFolders.next() : targetFolder.createFolder('admin_only');
    }
  }
  const file = targetFolder.createFile(fileBlob);
  const fileId = file.getId();
  const payeeName = getPayeeName(docData.taxId);
  getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET).appendRow([
    docData.taxId, payeeName, docData.type, docData.period, file.getName(), fileId, new Date(), Math.round(file.getSize() / 1024) + ' KB', docData.notes || '', docData.project || '', docData.visibility || 'payee'
  ]);
  return { success: true, fileId: fileId };
}

function uploadDocumentBase64(docData, base64Data, mimeType, fileName) {
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  return uploadDocument(docData, blob);
}

function updateDocument(rowIndex, docData) {
  const sheet = getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET);
  // Parse "YYYY-MM" period into a Date (first of month) so Sheets stores as Date, not text.
  // This prevents locale-dependent auto-parsing that can shift the month by 1.
  let periodValue = docData.period || '';
  const pm = periodValue.match(/^(\d{4})-(\d{2})$/);
  if (pm) {
    // Use Utilities.parseDate to ensure correct timezone handling
    // Use Date.UTC at noon (12:00) to avoid Bangkok timezone rollback:
    // new Date(y, m-1, 1) = midnight UTC = Jan 31 in Bangkok (UTC+7) for Feb → wrong month.
    // Anchoring at 12:00 UTC means Bangkok sees 19:00 same day → correct month always.
    periodValue = new Date(Date.UTC(parseInt(pm[1]), parseInt(pm[2]) - 1, 1, 12, 0, 0));
  }
  // Batch write: type(C), period(D), notes(I), project(J), visibility(K)
  sheet.getRange(rowIndex, 3).setValue(docData.type);
  sheet.getRange(rowIndex, 4).setValue(periodValue);
  sheet.getRange(rowIndex, 9).setValue(docData.notes || '');
  sheet.getRange(rowIndex, 10).setValue(docData.project || '');
  sheet.getRange(rowIndex, 11).setValue(docData.visibility || 'payee');
  return { success: true };
}

function deleteDocument(rowIndex) {
  getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET).deleteRow(rowIndex);
  return { success: true };
}

function bulkUpdateVisibility(rowIndices, visibility) {
  const sheet = getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET);
  rowIndices.sort((a, b) => b - a).forEach(ri => { sheet.getRange(ri, 11).setValue(visibility); });
  return { success: true };
}

function bulkDeleteDocuments(rowIndices) {
  const sheet = getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET);
  rowIndices.sort((a, b) => b - a).forEach(ri => { sheet.deleteRow(ri); });
  return { success: true };
}

function runSync() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const docSheet = getSS().getSheetByName(CONFIG.DOCUMENTS_SHEET);
  const existingData = getOptimizedData(docSheet);
  const existingFileIds = new Set();
  for (let i = 1; i < existingData.length; i++) existingFileIds.add(safeVal(existingData[i][5]));
  const results = [];
  scanFolder(folder, '', existingFileIds, docSheet, results);
  return { success: true, newFiles: results.length, details: results, message: 'Sync complete. New files: ' + results.length };
}

function scanFolder(folder, path, existingFileIds, docSheet, results) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileId = file.getId();
    if (existingFileIds.has(fileId)) continue;
    const filename = file.getName();
    const mime = file.getMimeType();
    if (!mime.startsWith('image/') && mime !== 'application/pdf') continue;
    
    const type = detectDocType(filename, path);
    const visibility = path.includes('admin_only') ? 'admin' : 'payee';
    const taxId = detectTaxId(filename, path);
    const period = detectPeriod(filename);
    const project = detectProject(path);
    const payeeName = taxId ? getPayeeName(taxId) : '';
    
    docSheet.appendRow([taxId, payeeName, type, period, filename, fileId, new Date(), Math.round(file.getSize() / 1024) + ' KB', 'Auto-synced', project, visibility]);
    existingFileIds.add(fileId);
    results.push({ filename: filename, type: type, method: path ? 'subfolder' : 'filename' });
  }
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const sub = subfolders.next();
    scanFolder(sub, path ? path + '/' + sub.getName() : sub.getName(), existingFileIds, docSheet, results);
  }
}

let _payeeNameCache = null;
function getPayeeNameMap_() {
  if (_payeeNameCache) return _payeeNameCache;
  const data = getOptimizedData(getSS().getSheetByName(CONFIG.PAYEES_SHEET));
  _payeeNameCache = {};
  for (let i = 1; i < data.length; i++) _payeeNameCache[safeVal(data[i][0])] = safeVal(data[i][2]);
  return _payeeNameCache;
}
function getPayeeName(taxId) { return taxId ? getPayeeNameMap_()[String(taxId).trim()] || '' : ''; }

function detectDocType(filename, path) {
  const lower = (filename + ' ' + path).toLowerCase();
  if (lower.includes('payment_slip') || lower.includes('ใบสำคัญจ่าย') || lower.includes('payment slip')) return 'payment_slip';
  if (lower.includes('payment_voucher') || lower.includes('ใบสำคัญรับเงิน') || lower.includes('payment voucher')) return 'payment_voucher';
  if (lower.includes('wht') || lower.includes('หัก ณ ที่จ่าย') || lower.includes('withholding')) return 'wht';
  if (lower.includes('invoice') || lower.includes('ใบแจ้งหนี้')) return 'invoice';
  if (lower.includes('receipt') || lower.includes('ใบเสร็จ')) return 'receipt';
  if (lower.includes('id_document') || lower.includes('บัตรประชาชน') || lower.includes('สมุดบัญชี') || lower.includes('เอกสารประจำตัว')) return 'id_document';
  return 'other';
}

function detectTaxId(filename, path) {
  const match = (filename + ' ' + path).match(/\b(\d{13})\b/);
  return match ? match[1] : '';
}

function detectPeriod(filename) {
  let match = filename.match(/(\d{4})-?(\d{2})/);
  if (match) {
    const year = parseInt(match[1]), month = match[2];
    if (year >= 2020 && year <= 2030 && parseInt(month) >= 1 && parseInt(month) <= 12) return year + '-' + month;
  }
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
}

function detectProject(path) {
  if (!path) return '';
  const parts = path.split('/').filter(p => p && p !== 'admin_only');
  return parts.length >= 2 ? parts[1] : '';
}

function runAutoSync() {
  try {
    const result = runSync();
    if (result.newFiles > 0) Logger.log('Auto-sync found ' + result.newFiles + ' new files');
  } catch (e) { Logger.log('Auto-sync error: ' + e.toString()); }
}