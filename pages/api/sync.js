'use strict';
const { requireAdmin } = require('../../lib/auth');
const { readSheet, appendRow, safeStr, normalizePeriod } = require('../../lib/sheets');
const { listAllFiles } = require('../../lib/drive');

const PAYEES = 'Payees';
const DOCS   = 'Documents';

export const config = {
  api: { responseLimit: false },
  maxDuration: 60,
};

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const [existingDocs, payeeRows, driveFiles] = await Promise.all([
      readSheet(DOCS),
      readSheet(PAYEES),
      listAllFiles(),
    ]);

    // Build set of existing file IDs
    const existingIds = new Set(existingDocs.slice(1).map(r => safeStr(r[5])).filter(Boolean));

    // Build payee name map
    const nameMap = {};
    for (const r of payeeRows.slice(1)) {
      const tid = safeStr(r[0]);
      if (tid) nameMap[tid] = safeStr(r[2]);
    }

    const newFiles = [];
    for (const file of driveFiles) {
      if (existingIds.has(file.id)) continue;

      const type       = detectDocType(file.name, file.path);
      const visibility = file.path && file.path.includes('admin_only') ? 'admin' : 'payee';
      const taxId      = detectTaxId(file.name, file.path);
      const period     = detectPeriod(file.name);
      const project    = detectProject(file.path);
      const payeeName  = taxId ? (nameMap[taxId] || '') : '';
      const sizeKB     = file.size ? `${Math.round(Number(file.size) / 1024)} KB` : '';

      await appendRow(DOCS, [
        taxId, payeeName, type, period, file.name, file.id,
        new Date().toISOString().slice(0, 10), sizeKB, 'Auto-synced', project, visibility,
      ]);

      existingIds.add(file.id);
      newFiles.push({ filename: file.name, type });
    }

    return res.json({
      success: true,
      newFiles: newFiles.length,
      details: newFiles,
      message: `Sync complete. New files: ${newFiles.length}`,
    });
  } catch (err) {
    console.error('sync error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function detectDocType(filename, path) {
  const lower = `${filename} ${path}`.toLowerCase();
  if (lower.includes('payment_slip') || lower.includes('ใบสำคัญจ่าย')) return 'payment_slip';
  if (lower.includes('payment_voucher') || lower.includes('ใบสำคัญรับเงิน')) return 'payment_voucher';
  if (lower.includes('wht') || lower.includes('withholding') || lower.includes('หัก ณ ที่จ่าย')) return 'wht';
  if (lower.includes('invoice') || lower.includes('ใบแจ้งหนี้')) return 'invoice';
  if (lower.includes('receipt') || lower.includes('ใบเสร็จ')) return 'receipt';
  if (lower.includes('id_document') || lower.includes('บัตรประชาชน') || lower.includes('สมุดบัญชี')) return 'id_document';
  return 'other';
}

function detectTaxId(filename, path) {
  const m = `${filename} ${path}`.match(/\b(\d{13})\b/);
  return m ? m[1] : '';
}

function detectPeriod(filename) {
  const m = filename.match(/(\d{4})-?(\d{2})/);
  if (m) {
    const year = parseInt(m[1]);
    const month = m[2];
    if (year >= 2020 && year <= 2035 && parseInt(month) >= 1 && parseInt(month) <= 12) {
      return `${year}-${month}`;
    }
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function detectProject(path) {
  if (!path) return '';
  const parts = path.split('/').filter(p => p && p !== 'admin_only');
  return parts.length >= 2 ? parts[1] : '';
}
export default handler;
