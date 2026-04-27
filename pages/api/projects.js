'use strict';
const { requireAdmin } = require('../../lib/auth');
const { readSheet, appendRow, safeStr } = require('../../lib/sheets');

const PROJECTS = 'Project list';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { name, date, billingClient, endClient } = req.body || {};
  if (!name) return res.status(400).json({ success: false, error: 'MISSING_NAME' });

  try {
    const rows = await readSheet(PROJECTS);
    const dup = rows.slice(1).some(r => safeStr(r[0]).toLowerCase() === safeStr(name).toLowerCase());
    if (dup) return res.json({ success: false, error: 'DUPLICATE' });
    await appendRow(PROJECTS, [name, date || '', billingClient || '', endClient || '']);
    return res.json({ success: true });
  } catch (err) {
    console.error('addProject error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
module.exports = handler;
