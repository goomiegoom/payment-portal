'use strict';
const { requireAdmin } = require('../../../lib/auth');
const { batchUpdateCells } = require('../../../lib/sheets');

const DOCS = 'Documents';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { rowIndex, type, period, project, visibility, notes } = req.body || {};
  if (!rowIndex) return res.status(400).json({ success: false, error: 'MISSING_ROW_INDEX' });

  try {
    await batchUpdateCells(DOCS, [
      { row: rowIndex, startCol: 3,  values: [type || ''] },
      { row: rowIndex, startCol: 4,  values: [period || ''] },
      { row: rowIndex, startCol: 9,  values: [notes || '', project || '', visibility || 'payee'] },
    ]);
    return res.json({ success: true });
  } catch (err) {
    console.error('updateDocument error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
module.exports = handler;
