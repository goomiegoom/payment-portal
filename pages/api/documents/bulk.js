'use strict';
const { requireAdmin } = require('../../../lib/auth');
const { batchUpdateCells, deleteRows } = require('../../../lib/sheets');

const DOCS = 'Documents';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { action, rowIndices, visibility } = req.body || {};
  if (!Array.isArray(rowIndices) || rowIndices.length === 0) {
    return res.status(400).json({ success: false, error: 'MISSING_ROW_INDICES' });
  }

  try {
    if (action === 'visibility') {
      const updates = rowIndices.map(ri => ({ row: ri, startCol: 11, values: [visibility || 'payee'] }));
      await batchUpdateCells(DOCS, updates);
      return res.json({ success: true });
    }

    if (action === 'delete') {
      await deleteRows(DOCS, rowIndices);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('bulk error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
export default handler;
