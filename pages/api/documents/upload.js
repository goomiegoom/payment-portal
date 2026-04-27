'use strict';
const { requireAdmin } = require('../../../lib/auth');
const { readSheet, appendRow, safeStr } = require('../../../lib/sheets');
const { uploadFile } = require('../../../lib/drive');


const PAYEES = 'Payees';
const DOCS   = 'Documents';

async function getPayeeName(taxId) {
  if (!taxId) return '';
  const rows = await readSheet(PAYEES);
  const row = rows.slice(1).find(r => safeStr(r[0]) === safeStr(taxId));
  return row ? safeStr(row[2]) : '';
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { docData, base64Data, mimeType, fileName } = req.body || {};
  if (!base64Data || !fileName) return res.status(400).json({ success: false, error: 'MISSING_FIELDS' });

  try {
    const { fileId, fileName: savedName, size } = await uploadFile(
      { taxId: docData.taxId, project: docData.project, visibility: docData.visibility },
      base64Data,
      mimeType,
      fileName,
    );

    const payeeName = await getPayeeName(docData.taxId);
    const sizeKB = size ? `${Math.round(Number(size) / 1024)} KB` : '';

    await appendRow(DOCS, [
      docData.taxId,
      payeeName,
      docData.type,
      docData.period,
      savedName,
      fileId,
      new Date().toISOString().slice(0, 10),
      sizeKB,
      docData.notes || '',
      docData.project || '',
      docData.visibility || 'payee',
    ]);

    return res.json({ success: true, fileId });
  } catch (err) {
    console.error('upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
export default handler;
