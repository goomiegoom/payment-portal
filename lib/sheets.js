'use strict';
const { google } = require('googleapis');
const { getAuth } = require('./google');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function sheetsApi() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

async function readSheet(sheetName) {
  const api = await sheetsApi();
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return res.data.values || [];
}

async function appendRow(sheetName, values) {
  const api = await sheetsApi();
  await api.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

// row and col are 1-based; values is an array of consecutive column values
async function updateCells(sheetName, row, startCol, values) {
  const api = await sheetsApi();
  const startLetter = colToLetter(startCol);
  const endLetter = colToLetter(startCol + values.length - 1);
  await api.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${startLetter}${row}:${endLetter}${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Update multiple non-consecutive ranges in one API call
async function batchUpdateCells(sheetName, updates) {
  const api = await sheetsApi();
  const data = updates.map(({ row, startCol, values }) => ({
    range: `${sheetName}!${colToLetter(startCol)}${row}:${colToLetter(startCol + values.length - 1)}${row}`,
    values: [values],
  }));
  await api.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// rowIndices is an array of 1-based row numbers to delete
async function deleteRows(sheetName, rowIndices) {
  const api = await sheetsApi();
  const meta = await api.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheetMeta = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheetMeta) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheetMeta.properties.sheetId;

  // Sort descending so earlier deletions don't shift later row indices
  const sorted = [...rowIndices].sort((a, b) => b - a);
  const requests = sorted.map(ri => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: ri - 1, endIndex: ri },
    },
  }));
  await api.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}

function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

// Normalize period: handles "YYYY-MM", "YYYY-M", Google Sheets date serials
function normalizePeriod(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0');
  // Google Sheets serial date (large integer)
  const num = parseFloat(s);
  if (!isNaN(num) && num > 10000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return s;
}

function safeStr(val) {
  if (val == null) return '';
  return String(val).trim();
}

module.exports = { readSheet, appendRow, updateCells, batchUpdateCells, deleteRows, normalizePeriod, safeStr };
