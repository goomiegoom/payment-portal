'use strict';
const { requireAdmin } = require('../../../lib/auth');
const { deleteRows } = require('../../../lib/sheets');

const DOCS = 'Documents';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { rowIndex } = req.body || {};
  if (!rowIndex) return res.status(400).json({ success: false, error: 'MISSING_ROW_INDEX' });

  try {
    await deleteRows(DOCS, [rowIndex]);
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteDocument error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
module.exports = handler;
