'use strict';
const { requireAdmin } = require('../../lib/auth');
const { readSheet, appendRow, updateCells, safeStr } = require('../../lib/sheets');

const PAYEES = 'Payees';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { action, taxId, pref, name, name_en, codename, address, bank, branch, accountNo } = req.body || {};

  try {
    const rows = await readSheet(PAYEES);

    if (action === 'add') {
      // Check for duplicate
      const dup = rows.slice(1).some(r => safeStr(r[0]) === safeStr(taxId));
      if (dup) return res.json({ success: false, error: 'DUPLICATE' });
      await appendRow(PAYEES, [taxId, pref, name, name_en, codename, address, bank, branch, accountNo]);
      return res.json({ success: true });
    }

    if (action === 'update') {
      const idx = rows.slice(1).findIndex(r => safeStr(r[0]) === safeStr(taxId));
      if (idx === -1) return res.json({ success: false, error: 'NOT_FOUND' });
      const rowNum = idx + 2; // +1 for header, +1 for 1-based
      await updateCells(PAYEES, rowNum, 2, [pref, name, name_en, codename, address, bank, branch, accountNo]);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('payees error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
module.exports = handler;
