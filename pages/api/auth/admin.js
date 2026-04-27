'use strict';
const { signAdminToken } = require('../../../lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { passkey } = req.body || {};
  if (passkey && passkey === process.env.ADMIN_PASSKEY) {
    return res.json({ success: true, token: signAdminToken() });
  }
  return res.json({ success: false });
};
